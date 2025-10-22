import React from 'react';
import ReactDOM from 'react-dom/client';

// 簡單的測試組件
const TestApp = () => {
  return (
    <div style={{ 
      padding: '20px', 
      color: 'white', 
      backgroundColor: '#101014',
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h1 style={{ color: '#00FFFF', marginBottom: '20px' }}>
        Trap Nation-Style Music Visualizer
      </h1>
      <p>如果您看到這個頁面，表示 React 已經正確載入！</p>
      <p>現在正在載入完整的應用程式...</p>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => {
            // 嘗試載入完整應用程式
            import('./App').then(({ default: App }) => {
              const root = ReactDOM.createRoot(document.getElementById('root'));
              root.render(<App />);
            }).catch(error => {
              console.error('Failed to load App:', error);
              alert('載入應用程式失敗：' + error.message);
            });
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#00FFFF',
            color: 'black',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          載入完整應用程式
        </button>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<TestApp />);
} catch (error) {
  console.error('Failed to render test app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: white; background-color: #101014; min-height: 100vh;">
      <h1>載入失敗</h1>
      <p>無法載入應用程式：${error.message}</p>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background-color: #00FFFF; color: black; border: none; border-radius: 5px; cursor: pointer;">
        重新載入
      </button>
    </div>
  `;
}
