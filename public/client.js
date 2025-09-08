// Inicializar Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAPpjfaBMnLFZjCrB5CJMbhxAhooUPJe1s",
  authDomain: "kriative-580d2.firebaseapp.com",
  projectId: "kriative-580d2",
  storageBucket: "kriative-580d2.appspot.com",
  messagingSenderId: "52644020736",
  appId: "kriative-580d2"
};
firebase.initializeApp(firebaseConfig);

const generateContent = firebase.functions().httpsCallable('generateContent');
const generateImage = firebase.functions().httpsCallable('generateImage');
const createCheckoutSession = firebase.functions().httpsCallable('createCheckoutSession');

const stripe = Stripe('pk_live_51S4sXvQkLGMwbBK1TaRmGouHh4u3iiOC19188EOKFgA2QYsIsg794zDthRzK9DPmwGaPhKliPdAJXXNius8VLIGk00jUlnwGo3'); // Substitua pela sua chave pública do Stripe

document.getElementById('content-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    platform: formData.get('platform'),
    style: formData.get('style'),
    format: formData.get('format'),
    pages: formData.get('pages'),
    imageStyle: formData.get('imageStyle'),
    inputType: formData.get('inputType'),
    contentDescription: formData.get('contentDescription'),
  };

  if (data.inputType === 'Prompt de Imagem') {
    const file = formData.get('imageData');
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        data.imageData = reader.result.split(',')[1]; // Remove "data:image/jpeg;base64,"
        await callGenerateContent(data);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Por favor, carregue uma imagem.');
    }
  } else {
    await callGenerateContent(data);
  }
});

async function callGenerateContent(data) {
  try {
    let result;
    if (data.format === 'Imagem') {
      result = await generateImage({ prompt: data.contentDescription, imageStyle: data.imageStyle });
      document.getElementById('generated-content').innerHTML = `<img src="${result.data.imageUrl}" alt="Conteúdo Gerado">`;
      document.getElementById('download-content').href = result.data.imageUrl;
      document.getElementById('download-content').style.display = 'block';
    } else {
      result = await generateContent(data);
      document.getElementById('generated-content').innerText = result.data.content;
      document.getElementById('download-content').href = `data:text/plain;charset=utf-8,${encodeURIComponent(result.data.content)}`;
      document.getElementById('download-content').style.display = 'block';
    }
    document.getElementById('success-modal').style.display = 'block';
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao gerar conteúdo: ' + error.message);
  }
}

document.getElementById('subscribe-premium').addEventListener('click', async () => {
  try {
    const result = await createCheckoutSession();
    stripe.redirectToCheckout({ sessionId: result.data.id });
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao criar sessão de checkout: ' + error.message);
  }
});