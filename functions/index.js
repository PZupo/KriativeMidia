const functions = require('firebase-functions');
const fetch = require('node-fetch');
const { Storage } = require('@google-cloud/storage');
const { VertexAI } = require('@google-cloud/vertexai');
const stripe = require('stripe')('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');

// Inicializar Vertex AI
const vertexAI = new VertexAI({
  project: 'kriative-580d2',
  location: 'us-central1',
  googleAuthOptions: {
    keyFilename: './credentials.json'
  }
});

// Inicializar Storage para salvar imagens
const storage = new Storage({
  keyFilename: './firebase-credentials.json'
});
const bucket = storage.bucket('kriative-580d2.appspot.com');

// Função para gerar texto com Gemini
exports.generateContent = functions.https.onRequest(async (req, res) => {
  const { platform, style, format, pages, imageStyle, inputType, contentDescription, imageData } = req.body;
  const prompt = `Gere conteúdo viral para ${platform} no formato ${format} com ${pages} páginas, estilo ${style} e imagem ${imageStyle}. Descrição: ${contentDescription}.` + 
    (format === 'Revista' && style === 'Estilo Mangá' ? ' Gere uma história em estilo mangá com painéis descritivos para cada página.' : '');
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
  };
  if (imageData) {
    body.contents[0].parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageData } });
    body.contents[0].parts[0].text += ' Baseado nesta imagem.';
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyAPpjfaBMnLFZjCrB5CJMbhxAhooUPJe1s`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content) {
      throw new Error('Resposta inválida da API');
    }
    res.json({ content: data.candidates[0].content.parts[0].text, type: 'text' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Função para gerar imagem com Imagen
exports.generateImage = functions.https.onRequest(async (req, res) => {
  const { prompt, imageStyle } = req.body;
  const imagePrompt = `Crie uma imagem no estilo ${imageStyle} com base no seguinte prompt: ${prompt}`;

  try {
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'imagegeneration@006'
    });

    const result = await generativeModel.generateImage({
      prompt: imagePrompt,
      numberOfImages: 1,
      aspectRatio: '1:1',
      negativePrompt: 'texto, logotipos, marcas d'água'
    });

    if (!result || !result[0].data) {
      throw new Error('Falha ao gerar imagem');
    }

    const imageBuffer = Buffer.from(result[0].data, 'base64');
    const fileName = `images/${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    await file.save(imageBuffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    res.json({ imageUrl, type: 'image' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Função para criar sessão de checkout do Stripe
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Plano Premium Kriative',
              description: 'Acesso a geração de revistas em estilo Mangá'
            },
            unit_amount: 1990, // R$19,90 em centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://kriative-580d2.web.app/success',
      cancel_url: 'https://kriative-580d2.web.app/cancel',
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});