document.addEventListener('DOMContentLoaded', () => {
    // Инициализация интерфейса мессенджера
    const maxApp = window.MaxWebApp;

    if (maxApp) {
        maxApp.ready();
        maxApp.expand();

        const initData = maxApp.initDataUnsafe;
        const greetingElement = document.getElementById('user-greeting');
        
        if (initData && initData.user) {
            greetingElement.textContent = `Мир вам, ${initData.user.first_name}`;
        } else {
            greetingElement.textContent = 'Мир вам!';
        }
    } else {
        console.warn('MAX Web App SDK не найден. Приложение запущено вне мессенджера.');
        document.getElementById('user-greeting').textContent = 'Мир вам! (Режим разработки)';
    }

    // Логика кнопки поиска и связи с Yandex Cloud
    document.getElementById('search-btn').addEventListener('click', async () => {
        const query = document.getElementById('search-input').value;
        if (!query) return;
        
        const results = document.getElementById('results-container');
        results.innerHTML = `<p><em>Отправляем запрос в Яндекс Облако...</em></p>`;
        
        try {
            // Формируем URL с вашим вопросом
            // Функция encodeURIComponent делает текст безопасным для передачи в ссылке
            const yandexCloudUrl = `https://functions.yandexcloud.net/d4e7o4ivid26hthcabc9?text=${encodeURIComponent(query)}`;
            
            // Отправляем запрос и ждем ответ
            const response = await fetch(yandexCloudUrl);
            const data = await response.json();
            
            // Выводим ответ на экран
            results.innerHTML = `<p>${data.message || JSON.stringify(data)}</p>`;
        } catch (error) {
            console.error('Ошибка при обращении к серверу:', error);
            results.innerHTML = `<p style="color: red;">Произошла ошибка при связи с сервером. Попробуйте еще раз.</p>`;
        }
    });
});