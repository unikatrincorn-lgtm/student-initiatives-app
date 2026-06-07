import React, { useEffect, useState } from 'react';
import { Spinner, Div, Text } from '@vkontakte/vkui';

function VKAuth({ children, onAuthSuccess }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Просто загружаем тестового пользователя
    console.log('🔐 Загружаем тестового пользователя...');
    
    const demoUser = {
      id: 1,
      vk_id: 123456789,
      first_name: 'Анна',
      last_name: 'Петрова',
      role: 'student',
      group_name: 'МВА-122'
    };
    
    // Сохраняем в localStorage
    localStorage.setItem('user', JSON.stringify(demoUser));
    localStorage.setItem('token', 'demo-token-123');
    
    // Передаём пользователя в приложение
    if (onAuthSuccess) {
      onAuthSuccess(demoUser);
    }
    
    setLoading(false);
  }, [onAuthSuccess]);

  if (loading) {
    return (
      <Div style={{ textAlign: 'center', padding: '50px' }}>
        <Spinner size="large" />
        <Text>Загрузка приложения...</Text>
      </Div>
    );
  }

  return children;
}

export default VKAuth;