import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ConfigProvider,
  AppRoot,
  View,
  Panel,
  PanelHeader,
  Group,
  Div,
  Title,
  Text,
  Button,
  Input,
  Textarea,
  Select,
  Card,
  Caption,
  FormItem,
  Tabbar,
  TabbarItem,
  Avatar,
} from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import {
  Icon28Newsfeed,
  Icon28AddSquareOutline,
  Icon28UserOutline,
  Icon28Users,
} from '@vkontakte/icons';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ==================== КОМПОНЕНТ ЧАТА ====================
function ChatModal({ initiative, currentUser, messages, loading, unreadCount, onClose, onSendMessage, onMarkAsRead }) {
  const [newMessage, setNewMessage] = useState('');
  
  useEffect(() => {
    if (unreadCount > 0 && onMarkAsRead) {
      onMarkAsRead(initiative.id);
    }
  }, []);
  
  const getPartnerName = () => {
    if (currentUser.role === 'chairman') return 'председателем';
    if (initiative.author_id === currentUser.id && initiative.responsible_id) {
      return initiative.responsible_id === 3 ? 'Марией Советовой' : 'ответственным';
    }
    if (initiative.responsible_id === currentUser.id) {
      return `автором (${initiative.first_name} ${initiative.last_name})`;
    }
    return 'автором';
  };
  
  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage(initiative.id, currentUser.id, 
      initiative.author_id === currentUser.id ? initiative.responsible_id : initiative.author_id, 
      newMessage);
    setNewMessage('');
  };
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '450px', maxWidth: '90%', height: '550px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', borderRadius: '12px 12px 0 0' }}>
          <Title level="3" style={{ fontSize: '18px' }}>💬 Чат: {initiative.title}</Title>
          <Button mode="outline" onClick={onClose} style={{ minWidth: 'auto', padding: '8px 12px', color: '#000', borderColor: '#ccc' }}>
            ✕
          </Button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff' }}>
          {loading && <Text style={{ textAlign: 'center' }}>Загрузка сообщений...</Text>}
          {!loading && messages.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#999' }}>Нет сообщений. Напишите что-нибудь {getPartnerName()}!</Text>
          )}
          {messages.map((msg) => (
            <div key={msg.id} style={{ 
              alignSelf: msg.sender_id === currentUser.id ? 'flex-end' : 'flex-start',
              background: msg.sender_id === currentUser.id ? '#0077ff' : '#f0f2f5',
              color: msg.sender_id === currentUser.id ? 'white' : '#000',
              padding: '10px 14px',
              borderRadius: '16px',
              maxWidth: '80%',
              position: 'relative'
            }}>
              <Text style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
                {msg.sender_id === currentUser.id ? 'Вы' : `${msg.sender_first_name} ${msg.sender_last_name}`}
              </Text>
              <Text style={{ fontSize: '14px', wordWrap: 'break-word' }}>{msg.message}</Text>
              <Caption style={{ fontSize: '10px', marginTop: '4px', color: msg.sender_id === currentUser.id ? 'rgba(255,255,255,0.7)' : '#999' }}>
                {new Date(msg.created_at).toLocaleTimeString()}
                {!msg.is_read && msg.receiver_id === currentUser.id && (
                  <span style={{ marginLeft: '8px', color: '#ff9800' }}>● Новое</span>
                )}
              </Caption>
            </div>
          ))}
        </div>
        
        <div style={{ padding: '16px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px', background: '#f8f9fa', borderRadius: '0 0 12px 12px' }}>
          <Input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Сообщение для ${getPartnerName()}...`}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            style={{ flex: 1 }}
          />
          <Button mode="primary" onClick={handleSend}>Отправить</Button>
        </div>
      </div>
    </div>
  );
}

// ==================== КОМПОНЕНТ УПРАВЛЕНИЯ СТАТУСАМИ ====================
function StatusManager({ initiative, onStatusChange, userId }) {
  if (initiative.responsible_id !== userId) return null;
  
  const statuses = [
    { label: '👀 На рассмотрении', value: 'На рассмотрении', color: '#2196f3' },
    { label: '⚙️ В работе', value: 'В работе', color: '#ff9800' },
    { label: '✅ Реализована', value: 'Реализована', color: '#4caf50' },
  ];
  
  return (
    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {statuses.map(s => (
        <Button
          key={s.value}
          size="s"
          mode={initiative.status === s.value ? 'primary' : 'outline'}
          onClick={() => onStatusChange(initiative.id, s.value, null)}
          style={{ 
            background: initiative.status === s.value ? s.color : 'transparent', 
            borderColor: s.color, 
            color: initiative.status === s.value ? 'white' : s.color 
          }}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}

// ==================== КОМПОНЕНТ ГОЛОСОВАНИЯ ====================
function Voting({ initiative, currentUser, onVote, voteStats, userVote }) {
  const [showVoters, setShowVoters] = useState(false);
  const [voting, setVoting] = useState(false);
  
  const handleVote = async (voteValue) => {
    if (voting) return;
    setVoting(true);
    await onVote(initiative.id, voteValue);
    setVoting(false);
  };
  
  return (
    <div style={{ marginTop: '12px', padding: '8px', background: '#f0f2f5', borderRadius: '8px' }}>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button
            size="s"
            mode={userVote === 'for' ? 'primary' : 'outline'}
            onClick={() => handleVote('for')}
            disabled={voting}
            style={{ background: userVote === 'for' ? '#4caf50' : 'transparent', borderColor: '#4caf50', color: userVote === 'for' ? 'white' : '#4caf50' }}
          >
            👍 Поддерживаю
          </Button>
          <Button
            size="s"
            mode={userVote === 'against' ? 'primary' : 'outline'}
            onClick={() => handleVote('against')}
            disabled={voting}
            style={{ background: userVote === 'against' ? '#f44336' : 'transparent', borderColor: '#f44336', color: userVote === 'against' ? 'white' : '#f44336' }}
          >
            👎 Не поддерживаю
          </Button>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ color: '#4caf50', fontSize: '14px' }}>👍 {voteStats.for_count || 0}</span>
          <span style={{ color: '#f44336', fontSize: '14px' }}>👎 {voteStats.against_count || 0}</span>
          {(voteStats.for_count > 0 || voteStats.against_count > 0) && (
            <Button size="s" mode="outline" onClick={() => setShowVoters(!showVoters)}>
              {showVoters ? 'Скрыть' : 'Кто голосовал?'}
            </Button>
          )}
        </div>
      </div>
      {showVoters && (
        <div style={{ marginTop: '12px', padding: '8px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <Text style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Проголосовали:</Text>
          {voteStats.voters && voteStats.voters.length === 0 && (
            <Text style={{ fontSize: '12px', color: '#999' }}>Нет голосов</Text>
          )}
          {voteStats.voters && voteStats.voters.map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Text style={{ fontSize: '13px' }}>{v.first_name} {v.last_name}</Text>
              <span style={{ color: v.vote_value === 'for' ? '#4caf50' : '#f44336', fontSize: '13px' }}>
                {v.vote_value === 'for' ? '👍 За' : '👎 Против'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== КОМПОНЕНТ РОЛЕЙ ДЛЯ ПРЕДПРИНИМАТЕЛЬСКИХ ИНИЦИАТИВ ====================
function TeamRoles({ initiative, currentUser, teamRoles, onJoinRole, onCloseRole, onOpenRole, isInFeed = false }) {
  const [loading, setLoading] = useState(false);
  const isAuthor = initiative.author_id === currentUser.id;
  const allRolesFilled = teamRoles && teamRoles.length > 0 && teamRoles.every(role => role.is_filled === true);
  
  const handleClose = async (roleId) => {
    setLoading(true);
    await onCloseRole(roleId, initiative.id);
    setLoading(false);
  };
  
  const handleOpen = async (roleId) => {
    setLoading(true);
    await onOpenRole(roleId, initiative.id);
    setLoading(false);
  };
  
  if (!teamRoles || teamRoles.length === 0) return null;
  
  if (allRolesFilled) {
    return (
      <div style={{ marginTop: '12px', padding: '8px', background: '#e8f5e9', borderRadius: '8px' }}>
        <Text style={{ color: '#4caf50', textAlign: 'center' }}>🎉 Команда полностью собрана!</Text>
      </div>
    );
  }
  
  return (
    <div style={{ marginTop: '12px', padding: '8px', background: '#f0f2f5', borderRadius: '8px' }}>
      <Text style={{ fontWeight: 'bold', marginBottom: '8px' }}>👥 Требуемые роли:</Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {teamRoles.map(role => (
          <div key={role.id} style={{ 
            padding: '6px 12px', 
            background: role.is_filled ? '#e8f5e9' : '#fff',
            borderRadius: '20px',
            border: `1px solid ${role.is_filled ? '#4caf50' : '#ccc'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Text style={{ fontSize: '13px' }}>{role.role_name}</Text>
            {role.is_filled ? (
              <span style={{ fontSize: '12px', color: '#4caf50' }}>✅</span>
            ) : (
              <span style={{ fontSize: '12px', color: '#ff9800' }}>🔓</span>
            )}
          </div>
        ))}
      </div>
      
      {isInFeed && !isAuthor && !allRolesFilled && (
        <Button 
          size="s" 
          mode="primary" 
          onClick={() => {
            const availableRole = teamRoles.find(r => !r.is_filled);
            if (availableRole) {
              alert(`Для присоединения к команде свяжитесь с автором:\n${initiative.contact_info || 'Контакт не указан'}`);
            } else {
              alert('Все роли уже заняты!');
            }
          }} 
          disabled={loading}
          style={{ marginTop: '4px', width: '100%' }}
        >
          🤝 Хочу в команду
        </Button>
      )}
      
      {!isInFeed && isAuthor && (
        <div style={{ marginTop: '12px' }}>
          <Text style={{ fontSize: '13px', marginBottom: '8px' }}>Управление ролями (видимость в ленте):</Text>
          {teamRoles.map(role => (
            <div key={role.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '6px', background: '#fff', borderRadius: '8px' }}>
              <Text style={{ fontSize: '14px' }}>{role.role_name}</Text>
              <div>
                {role.is_filled ? (
                  <>
                    <Text style={{ fontSize: '12px', color: '#4caf50', display: 'inline', marginRight: '8px' }}>✅ Закрыта</Text>
                    <Button size="s" mode="outline" onClick={() => handleOpen(role.id)} disabled={loading} style={{ borderColor: '#2196f3', color: '#2196f3' }}>
                      Вернуть роль
                    </Button>
                  </>
                ) : (
                  <Button size="s" mode="outline" onClick={() => handleClose(role.id)} disabled={loading} style={{ borderColor: '#ff9800', color: '#ff9800' }}>
                    Закрыть роль
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== ОСНОВНОЙ КОМПОНЕНТ APP ====================
function App() {
  const [activeTab, setActiveTab] = useState('feed');
  const [initiatives, setInitiatives] = useState([]);
  const [myInitiatives, setMyInitiatives] = useState([]);
  const [responsibleInitiatives, setResponsibleInitiatives] = useState([]);
  const [unpublishedInitiatives, setUnpublishedInitiatives] = useState([]);
  const [acceptedInitiatives, setAcceptedInitiatives] = useState([]);
  const [rejectedInitiatives, setRejectedInitiatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voteStats, setVoteStats] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [chatModal, setChatModal] = useState({ open: false, initiative: null });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [teamRoles, setTeamRoles] = useState({});
  const [rejectModal, setRejectModal] = useState({ open: false, initiativeId: null });
  const [rejectReason, setRejectReason] = useState('');
  const [reworkModal, setReworkModal] = useState({ open: false, initiativeId: null });
  const [reworkReason, setReworkReason] = useState('');
  const [notificationModal, setNotificationModal] = useState({ open: false, text: '', type: 'default' });
  const [user, setUser] = useState({
    id: 1,
    first_name: 'Анна',
    last_name: 'Петрова',
    role: 'chairman',
  });
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'cultural',
    expected_result: '',
    roles_list: [''],
    contact_info: ''
  });

  const showNotification = (text, type = 'default') => {
    setNotificationModal({ open: true, text, type });
  };

  const fetchInitiatives = async () => {
    try {
      const res = await axios.get(`${API_URL}/initiatives`);
      setInitiatives(res.data || []);
    } catch (error) {
      setInitiatives([]);
    }
  };

  const fetchMyInitiatives = async () => {
    try {
      const res = await axios.get(`${API_URL}/my-initiatives?user_id=${user.id}`);
      setMyInitiatives(res.data || []);
    } catch (error) {
      setMyInitiatives([]);
    }
  };

  const fetchResponsibleInitiatives = async () => {
    try {
      const res = await axios.get(`${API_URL}/responsible-initiatives?user_id=${user.id}`);
      setResponsibleInitiatives(res.data || []);
    } catch (error) {
      setResponsibleInitiatives([]);
    }
  };

  const fetchUnpublishedInitiatives = async () => {
    if (user.role !== 'chairman') return;
    try {
      const res = await axios.get(`${API_URL}/unpublished-initiatives?user_role=${user.role}`);
      setUnpublishedInitiatives(res.data || []);
    } catch (error) {
      setUnpublishedInitiatives([]);
    }
  };

  const fetchAcceptedInitiatives = async () => {
    if (user.role !== 'chairman') return;
    try {
      const res = await axios.get(`${API_URL}/accepted-initiatives?user_role=${user.role}`);
      setAcceptedInitiatives(res.data || []);
    } catch (error) {
      setAcceptedInitiatives([]);
    }
  };

  const fetchRejectedInitiatives = async () => {
    try {
      const res = await axios.get(`${API_URL}/rejected-initiatives?user_id=${user.id}&user_role=${user.role}`);
      setRejectedInitiatives(res.data || []);
    } catch (error) {
      setRejectedInitiatives([]);
    }
  };

  const fetchTeamRoles = async (initiativeId) => {
    try {
      const res = await axios.get(`${API_URL}/team-roles/${initiativeId}`);
      setTeamRoles(prev => ({ ...prev, [initiativeId]: res.data }));
    } catch (error) {
      console.error('Ошибка загрузки ролей:', error);
    }
  };

  const fetchVoteStats = async (initiativeId) => {
    try {
      const response = await axios.get(`${API_URL}/votes/${initiativeId}`);
      setVoteStats(prev => ({ ...prev, [initiativeId]: response.data }));
      return response.data;
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      return { for_count: 0, against_count: 0, voters: [] };
    }
  };

  const handleVote = async (initiativeId, voteValue) => {
    try {
      await axios.post(`${API_URL}/votes`, {
        initiative_id: initiativeId,
        user_id: user.id,
        vote_value: voteValue
      });
      
      setUserVotes(prev => ({ ...prev, [initiativeId]: voteValue }));
      const stats = await fetchVoteStats(initiativeId);
      setVoteStats(prev => ({ ...prev, [initiativeId]: stats }));
      
      await Promise.all([
        fetchInitiatives(),
        fetchMyInitiatives(),
        fetchResponsibleInitiatives(),
        user.role === 'chairman' && fetchUnpublishedInitiatives(),
        user.role === 'chairman' && fetchAcceptedInitiatives(),
        fetchRejectedInitiatives()
      ]);
      
      showNotification(`Вы ${voteValue === 'for' ? 'поддержали' : 'не поддержали'} инициативу`);
    } catch (error) {
      showNotification('Ошибка при голосовании', 'error');
    }
  };

  const handleJoinRole = async (roleId, initiativeId) => {
    try {
      await axios.put(`${API_URL}/team-roles/${roleId}/join`, { user_id: user.id });
      await fetchTeamRoles(initiativeId);
      await fetchInitiatives();
      showNotification('Вы присоединились к команде!');
    } catch (error) {
      showNotification('Ошибка при присоединении', 'error');
    }
  };

  const handleCloseRole = async (roleId, initiativeId) => {
    try {
      await axios.put(`${API_URL}/team-roles/${roleId}/close`, { user_id: user.id });
      await fetchTeamRoles(initiativeId);
      await fetchInitiatives();
      await fetchMyInitiatives();
      showNotification('Роль закрыта!');
    } catch (error) {
      showNotification('Ошибка при закрытии роли', 'error');
    }
  };

  const handleOpenRole = async (roleId, initiativeId) => {
    try {
      await axios.put(`${API_URL}/team-roles/${roleId}/open`, { user_id: user.id });
      await fetchTeamRoles(initiativeId);
      await fetchInitiatives();
      await fetchMyInitiatives();
      showNotification('Роль открыта!');
    } catch (error) {
      showNotification('Ошибка при открытии роли', 'error');
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/unread-messages?user_id=${user.id}`);
      setUnreadMessages(response.data);
    } catch (error) {
      console.error('Ошибка загрузки непрочитанных:', error);
    }
  };

  const markMessagesAsRead = async (initiativeId) => {
    try {
      await axios.put(`${API_URL}/messages/read/${initiativeId}`, { user_id: user.id });
      setUnreadMessages(prev => ({ ...prev, [initiativeId]: 0 }));
    } catch (error) {
      console.error('Ошибка отметки прочитанных:', error);
    }
  };

  const fetchMessages = async (initiativeId) => {
    setChatLoading(true);
    try {
      const res = await axios.get(`${API_URL}/messages/${initiativeId}`);
      setChatMessages(res.data || []);
    } catch (error) {
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async (initiativeId, senderId, receiverId, message) => {
    try {
      await axios.post(`${API_URL}/messages`, {
        initiative_id: initiativeId,
        sender_id: senderId,
        receiver_id: receiverId,
        message
      });
      await fetchMessages(initiativeId);
      await fetchUnreadMessages();
    } catch (error) {
      showNotification('Не удалось отправить сообщение', 'error');
    }
  };

  const openChat = (initiative) => {
    setChatModal({ open: true, initiative });
    fetchMessages(initiative.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const data = {
        title: form.title,
        description: form.description,
        category: form.category,
        expected_result: form.expected_result || 'Ожидается реализация',
        author_id: user.id
      };
      
      if (form.category === 'entrepreneurial') {
        const rolesArray = (form.roles_list || []).filter(r => r && r.trim());
        data.roles_needed = rolesArray.join(', ');
        data.contact_info = form.contact_info;
      }
      
      const response = await axios.post(`${API_URL}/initiatives`, data);
      const initiativeId = response.data.id;
      
      if (form.category === 'entrepreneurial' && form.roles_list) {
        const rolesArray = form.roles_list.filter(r => r && r.trim());
        for (const role of rolesArray) {
          await axios.post(`${API_URL}/team-roles`, {
            initiative_id: initiativeId,
            role_name: role
          });
        }
      }
      
      setForm({ 
        title: '', 
        description: '', 
        category: 'cultural', 
        expected_result: '',
        roles_list: [''],
        contact_info: ''
      });
      await fetchMyInitiatives();
      await fetchResponsibleInitiatives();
      if (user.role === 'chairman') {
        await fetchUnpublishedInitiatives();
        await fetchAcceptedInitiatives();
      }
      showNotification('Инициатива создана! Председатель увидит её в профиле.');
    } catch (error) {
      showNotification('Ошибка при создании инициативы', 'error');
    } finally {
      setSending(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      await axios.put(`${API_URL}/initiatives/${id}/publish`, { user_role: user.role });
      await fetchInitiatives();
      await fetchMyInitiatives();
      await fetchResponsibleInitiatives();
      if (user.role === 'chairman') {
        await fetchUnpublishedInitiatives();
        await fetchAcceptedInitiatives();
      }
      showNotification('Инициатива опубликована в ленте!');
    } catch (error) {
      showNotification('Не удалось опубликовать инициативу', 'error');
    }
  };

  const handleAccept = async (id) => {
    try {
      await axios.put(`${API_URL}/initiatives/${id}/accept`, { user_role: user.role });
      await fetchMyInitiatives();
      await fetchResponsibleInitiatives();
      if (user.role === 'chairman') {
        await fetchUnpublishedInitiatives();
        await fetchAcceptedInitiatives();
      }
      showNotification('Инициатива принята! Теперь можно назначить ответственного.');
    } catch (error) {
      showNotification('Не удалось принять инициативу', 'error');
    }
  };

  const handleAssignResponsible = async (initiativeId, responsibleId) => {
    if (!responsibleId) return;
    try {
      await axios.put(`${API_URL}/initiatives/${initiativeId}/responsible`, { responsible_id: responsibleId, user_role: user.role });
      await fetchMyInitiatives();
      await fetchResponsibleInitiatives();
      await fetchInitiatives();
      if (user.role === 'chairman') {
        await fetchUnpublishedInitiatives();
        await fetchAcceptedInitiatives();
      }
      showNotification('Ответственный назначен!');
    } catch (error) {
      showNotification('Не удалось назначить ответственного', 'error');
    }
  };

  const handleStatusChange = async (id, newStatus, rejectionReason) => {
    try {
      await axios.put(`${API_URL}/initiatives/${id}/status`, {
        status: newStatus,
        rejection_reason: rejectionReason || null,
        user_id: user.id,
        user_role: user.role
      });
      await fetchInitiatives();
      await fetchMyInitiatives();
      await fetchResponsibleInitiatives();
      if (user.role === 'chairman') {
        await fetchUnpublishedInitiatives();
        await fetchAcceptedInitiatives();
      }
      showNotification(`Статус изменён на "${newStatus}"`);
    } catch (error) {
      showNotification('Не удалось изменить статус', 'error');
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      showNotification('Пожалуйста, укажите причину отклонения', 'error');
      return;
    }
    await handleStatusChange(id, 'Отклонена', rejectReason);
    setRejectModal({ open: false, initiativeId: null });
    setRejectReason('');
  };

  const handleRework = async (id) => {
    if (!reworkReason.trim()) {
      showNotification('Пожалуйста, укажите причину отправки на доработку', 'error');
      return;
    }
    await handleStatusChange(id, 'На доработке', reworkReason);
    setReworkModal({ open: false, initiativeId: null });
    setReworkReason('');
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'На модерации': return '#ff9800';
      case 'На рассмотрении': return '#2196f3';
      case 'В работе': return '#ff9800';
      case 'Реализована': return '#4caf50';
      case 'Отклонена': return '#f44336';
      case 'Отклонена голосованием': return '#f44336';
      case 'Принята к реализации': return '#4caf50';
      case 'На голосовании': return '#ff9800';
      case 'Команда собрана': return '#4caf50';
      case 'На доработке': return '#ff9800';
      default: return '#757575';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'На модерации': return '⏳ На модерации';
      case 'На рассмотрении': return '👀 На рассмотрении';
      case 'В работе': return '⚙️ В работе';
      case 'Реализована': return '✅ Реализована';
      case 'Отклонена': return '❌ Отклонена';
      case 'Отклонена голосованием': return '❌ Отклонена голосованием';
      case 'Принята к реализации': return '✅ Принята к реализации';
      case 'На голосовании': return '🗳️ На голосовании';
      case 'Команда собрана': return '🎉 Команда собрана';
      case 'На доработке': return '🔄 На доработке';
      default: return status;
    }
  };

  const categoryNames = {
    educational: '📚 Учебная',
    scientific: '🔬 Научная',
    cultural: '🎭 Культурно-массовая',
    social: '🤝 Социально-бытовая',
    sports: '⚽ Спортивная',
    infrastructure: '🏛️ Инфраструктурная',
    entrepreneurial: '💼 Предпринимательская'
  };

  let allMyInitiativesRaw;
  if (user.role === 'chairman') {
    const combined = [...(unpublishedInitiatives || []), ...(acceptedInitiatives || []), ...(rejectedInitiatives || [])];
    allMyInitiativesRaw = combined.filter((init, index, self) => 
      self.findIndex(i => i.id === init.id) === index
    );
  } else if (user.role === 'council_member') {
    allMyInitiativesRaw = [...(myInitiatives || []), ...(responsibleInitiatives || [])];
    allMyInitiativesRaw = allMyInitiativesRaw.filter((init, index, self) => 
      self.findIndex(i => i.id === init.id) === index
    );
  } else {
    allMyInitiativesRaw = [...(myInitiatives || [])];
    allMyInitiativesRaw = allMyInitiativesRaw.filter((init, index, self) => 
      self.findIndex(i => i.id === init.id) === index
    );
  }
  
  const allMyInitiatives = allMyInitiativesRaw.sort((a, b) => 
    new Date(b.updated_at) - new Date(a.updated_at)
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchInitiatives();
      await fetchMyInitiatives();
      await fetchResponsibleInitiatives();
      if (user.role === 'chairman') {
        await fetchUnpublishedInitiatives();
        await fetchAcceptedInitiatives();
      }
      await fetchRejectedInitiatives();
      await fetchUnreadMessages();
      setLoading(false);
    };
    loadData();
  }, [user.id, user.role]);

  useEffect(() => {
    const loadVotes = async () => {
      const allInitiativesList = [...initiatives, ...allMyInitiatives];
      for (const init of allInitiativesList) {
        if (init && init.id && init.category !== 'entrepreneurial') {
          await fetchVoteStats(init.id);
        }
      }
    };
    loadVotes();
  }, [initiatives, myInitiatives, responsibleInitiatives, unpublishedInitiatives, acceptedInitiatives, rejectedInitiatives]);

  useEffect(() => {
    const loadRoles = async () => {
      const allInitiativesList = [...initiatives, ...allMyInitiatives];
      for (const init of allInitiativesList) {
        if (init && init.id && init.category === 'entrepreneurial') {
          await fetchTeamRoles(init.id);
        }
      }
    };
    loadRoles();
  }, [initiatives, allMyInitiatives]);

  useEffect(() => {
    const loadUserVotes = async () => {
      try {
        const response = await axios.get(`${API_URL}/votes/user/${user.id}`);
        const votesMap = {};
        // Исправление: проверяем, что response.data — это массив
        if (Array.isArray(response.data)) {
          response.data.forEach(vote => {
            votesMap[vote.initiative_id] = vote.vote_value;
          });
        } else {
          console.log('Данные голосов не являются массивом:', response.data);
        }
        setUserVotes(votesMap);
      } catch (error) {
        console.error('Ошибка загрузки голосов пользователя:', error);
      }
    };
    loadUserVotes();
  }, [user.id]);

  const handleRoleChange = async (newRole) => {
    let newUser;
    if (newRole === 'student') {
      newUser = { id: 2, first_name: 'Иван', last_name: 'Студентов', role: 'student' };
    } else if (newRole === 'council_member') {
      newUser = { id: 3, first_name: 'Мария', last_name: 'Советова', role: 'council_member' };
    } else {
      newUser = { id: 1, first_name: 'Анна', last_name: 'Петрова', role: 'chairman' };
    }
    
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    setMyInitiatives([]);
    setResponsibleInitiatives([]);
    setInitiatives([]);
    setUnpublishedInitiatives([]);
    setAcceptedInitiatives([]);
    setRejectedInitiatives([]);
    setVoteStats({});
    setUserVotes({});
    
    setLoading(true);
    await fetchInitiatives();
    await fetchMyInitiatives();
    await fetchResponsibleInitiatives();
    if (newUser.role === 'chairman') {
      await fetchUnpublishedInitiatives();
      await fetchAcceptedInitiatives();
    }
    await fetchRejectedInitiatives();
    await fetchUnreadMessages();
    setLoading(false);
  };

  const roleNames = {
    student: '👨‍🎓 Студент',
    council_member: '👥 Член студсовета',
    chairman: '👑 Председатель'
  };

  return (
    <ConfigProvider>
      <AppRoot>
        <View activePanel="main">
          <Panel id="main">
            <PanelHeader after={
              <Select
                value={user.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                options={[
                  { label: '👨‍🎓 Студент (Иван)', value: 'student' },
                  { label: '👥 Член студсовета (Мария)', value: 'council_member' },
                  { label: '👑 Председатель (Анна)', value: 'chairman' }
                ]}
                style={{ width: '220px' }}
              />
            }>
              СтудИндикатива
            </PanelHeader>
            
            {activeTab === 'feed' && (
              <Group>
                {loading ? (
                  <Div style={{ textAlign: 'center', padding: '40px' }}><Text>Загрузка...</Text></Div>
                ) : initiatives.length === 0 ? (
                  <Div style={{ textAlign: 'center', padding: '40px' }}><Text>Нет опубликованных инициатив</Text></Div>
                ) : (
                  initiatives.map((init) => (
                    <Card key={init.id} mode="shadow" style={{ margin: '12px 16px' }}>
                      <Div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <Avatar size={40} initials={init.first_name?.[0] || 'А'} />
                          <div>
                            <Title level="3" style={{ fontSize: '16px' }}>{init.title}</Title>
                            <Caption level="1" style={{ color: '#818c99' }}>
                              {init.first_name} {init.last_name} • {new Date(init.created_at).toLocaleDateString()}
                            </Caption>
                          </div>
                        </div>
                        
                        <Text style={{ marginBottom: '12px', lineHeight: '1.4' }}>{init.description}</Text>
                        
                        {init.rejection_reason && (
                          <div style={{ marginBottom: '12px', padding: '8px', background: '#ffebee', borderRadius: '8px' }}>
                            <Text style={{ fontSize: '13px', color: '#f44336' }}>❌ Причина: {init.rejection_reason}</Text>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          <span style={{ background: '#f0f2f5', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                            {categoryNames[init.category] || init.category}
                          </span>
                          <span style={{ background: getStatusColor(init.status), color: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                            {getStatusText(init.status)}
                          </span>
                        </div>
                        
                        {init.category === 'entrepreneurial' && (
                          <TeamRoles
                            initiative={init}
                            currentUser={user}
                            teamRoles={teamRoles[init.id]}
                            onJoinRole={handleJoinRole}
                            onCloseRole={handleCloseRole}
                            onOpenRole={handleOpenRole}
                            isInFeed={true}
                          />
                        )}
                        
                        {init.category !== 'entrepreneurial' && (
                          <Voting
                            initiative={init}
                            currentUser={user}
                            onVote={handleVote}
                            voteStats={voteStats[init.id] || { for_count: 0, against_count: 0, voters: [] }}
                            userVote={userVotes[init.id]}
                          />
                        )}
                      </Div>
                    </Card>
                  ))
                )}
              </Group>
            )}
            
            {activeTab === 'new' && (
              <Group>
                <Div>
                  <Title level="2" style={{ marginBottom: '16px' }}>✨ Новая инициатива</Title>
                  <form onSubmit={handleSubmit}>
                    <FormItem top="Заголовок">
                      <Input 
                        value={form.title} 
                        onChange={(e) => setForm({...form, title: e.target.value})} 
                        placeholder="Кратко опишите идею" 
                        required 
                      />
                    </FormItem>
                    
                    <FormItem top="Описание">
                      <Textarea 
                        value={form.description} 
                        onChange={(e) => setForm({...form, description: e.target.value})} 
                        placeholder="Подробно расскажите о предложении" 
                        required 
                        rows={4} 
                      />
                    </FormItem>
                    
                    <FormItem top="Категория" required>
                      <Select 
                        value={form.category} 
                        onChange={(e) => {
                          setForm({...form, category: e.target.value});
                          if (e.target.value === 'entrepreneurial' && form.roles_list.length === 0) {
                            setForm({...form, category: e.target.value, roles_list: ['']});
                          }
                        }} 
                        options={[
                          { label: '📚 Учебная', value: 'educational' },
                          { label: '🔬 Научная', value: 'scientific' },
                          { label: '🎭 Культурно-массовая', value: 'cultural' },
                          { label: '🤝 Социально-бытовая', value: 'social' },
                          { label: '⚽ Спортивная', value: 'sports' },
                          { label: '🏛️ Инфраструктурная', value: 'infrastructure' },
                          { label: '💼 Предпринимательская', value: 'entrepreneurial' }
                        ]} 
                      />
                    </FormItem>
                    
                    {form.category === 'entrepreneurial' && (
                      <>
                        <FormItem top="👥 Роли в команду" required>
                          {form.roles_list.map((role, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                              <Input 
                                value={role}
                                onChange={(e) => {
                                  const newRoles = [...form.roles_list];
                                  newRoles[index] = e.target.value;
                                  setForm({...form, roles_list: newRoles});
                                }}
                                placeholder={`Роль ${index + 1}`}
                                required={index === 0 && form.roles_list.length === 1}
                                style={{ flex: 1 }}
                              />
                              {index === form.roles_list.length - 1 && (
                                <Button 
                                  size="s" 
                                  mode="outline" 
                                  onClick={() => setForm({...form, roles_list: [...form.roles_list, '']})}
                                  style={{ minWidth: 'auto', padding: '8px 12px' }}
                                >
                                  ➕
                                </Button>
                              )}
                              {form.roles_list.length > 1 && (
                                <Button 
                                  size="s" 
                                  mode="outline" 
                                  onClick={() => {
                                    const newRoles = form.roles_list.filter((_, i) => i !== index);
                                    setForm({...form, roles_list: newRoles});
                                  }}
                                  style={{ minWidth: 'auto', padding: '8px 12px', color: '#f44336', borderColor: '#f44336' }}
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                          ))}
                        </FormItem>
                        
                        <FormItem top="📞 Контакт для связи" required>
                          <Input 
                            value={form.contact_info} 
                            onChange={(e) => setForm({...form, contact_info: e.target.value})} 
                            placeholder="Telegram: @username / email / телефон" 
                            required
                          />
                        </FormItem>
                      </>
                    )}
                    
                    <FormItem top="Ожидаемый результат" required>
                      <Input 
                        value={form.expected_result} 
                        onChange={(e) => setForm({...form, expected_result: e.target.value})} 
                        placeholder="Что изменится после реализации?" 
                        required
                      />
                    </FormItem>
                    
                    <Button 
                      type="submit" 
                      size="l" 
                      stretched 
                      loading={sending} 
                      disabled={sending} 
                      style={{ marginTop: '8px' }}
                    >
                      Отправить инициативу
                    </Button>
                  </form>
                </Div>
              </Group>
            )}
            
            {activeTab === 'profile' && (
              <Group>
                <Div style={{ textAlign: 'center' }}>
                  <Avatar size={96} style={{ marginBottom: '16px' }} />
                  <Title level="2">{user.first_name} {user.last_name}</Title>
                  <Caption style={{ marginTop: '4px' }}>Роль: {roleNames[user.role]}</Caption>
                </Div>
                
                <Div>
                  <Title level="3" style={{ marginBottom: '12px' }}>📋 Мои инициативы</Title>
                  {allMyInitiatives.length === 0 ? (
                    <Text style={{ color: '#999', textAlign: 'center', padding: '20px' }}>Нет инициатив</Text>
                  ) : (
                    allMyInitiatives.map((init) => (
                      <Card key={init.id} mode="shadow" style={{ margin: '12px 0' }}>
                        <Div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <Title level="3" style={{ fontSize: '16px', flex: 1 }}>{init.title}</Title>
                            <span style={{ background: getStatusColor(init.status), color: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                              {getStatusText(init.status)}
                            </span>
                          </div>
                          
                          <Text style={{ marginBottom: '12px' }}>{init.description}</Text>
                          
                          {init.rejection_reason && (
                            <div style={{ marginBottom: '12px', padding: '8px', background: '#ffebee', borderRadius: '8px' }}>
                              <Text style={{ fontSize: '13px', color: '#f44336' }}>❌ Причина: {init.rejection_reason}</Text>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <span style={{ background: '#f0f2f5', padding: '4px 12px', borderRadius: '16px', fontSize: '13px' }}>
                              {categoryNames[init.category] || init.category}
                            </span>
                          </div>
                          
                          {user.role === 'chairman' && !init.is_published && init.status === 'На модерации' && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <Button size="s" mode="primary" onClick={() => handleAccept(init.id)} style={{ background: '#2196f3' }}>
                                ✅ Принять
                              </Button>
                              <Button size="s" mode="outline" onClick={() => handlePublish(init.id)} style={{ borderColor: '#4caf50', color: '#4caf50' }}>
                                📢 Опубликовать в ленту
                              </Button>
                              <Button size="s" mode="outline" onClick={() => setReworkModal({ open: true, initiativeId: init.id })} style={{ borderColor: '#ff9800', color: '#ff9800' }}>
                                🔄 На доработку
                              </Button>
                              <Button size="s" mode="outline" onClick={() => setRejectModal({ open: true, initiativeId: init.id })} style={{ borderColor: '#f44336', color: '#f44336' }}>
                                ❌ Отклонить
                              </Button>
                            </div>
                          )}
                          
                          {user.role === 'chairman' && !init.is_published && init.status === 'Принята к реализации' && !init.responsible_id && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: '13px', color: '#2196f3' }}>✅ Инициатива принята голосованием. Назначить ответственного:</Text>
                              <Select
                                value={init.responsible_id || ''}
                                onChange={(e) => handleAssignResponsible(init.id, parseInt(e.target.value))}
                                options={[
                                  { label: 'Не назначен', value: '' },
                                  { label: 'Мария Советова (Член студсовета)', value: 3 },
                                ]}
                                style={{ width: '260px' }}
                              />
                            </div>
                          )}
                          
                          {user.role === 'chairman' && !init.is_published && init.status === 'Принята к реализации' && init.responsible_id && (
                            <Caption style={{ color: '#4caf50', marginTop: '8px' }}>
                              ✅ Инициатива принята • Ответственный назначен
                            </Caption>
                          )}
                          
                          {user.role === 'chairman' && init.is_published && (
                            <Caption style={{ color: '#4caf50', marginTop: '8px' }}>
                              📢 Опубликовано в ленте
                            </Caption>
                          )}
                          
                          {user.role === 'student' && (
                            <>
                              {!init.is_published && init.status === 'На модерации' && (
                                <Caption style={{ color: '#ff9800', marginTop: '8px' }}>
                                  ⏳ Ожидает решения председателя
                                </Caption>
                              )}
                              {!init.is_published && init.status === 'Принята к реализации' && !init.responsible_id && (
                                <Caption style={{ color: '#2196f3', marginTop: '8px' }}>
                                  👀 Инициатива принята голосованием, ожидает назначения ответственного
                                </Caption>
                              )}
                              {!init.is_published && init.status === 'Принята к реализации' && init.responsible_id && (
                                <Caption style={{ color: '#4caf50', marginTop: '8px' }}>
                                  ✅ Инициатива принята, ответственный назначен
                                </Caption>
                              )}
                              {init.rejected_by_votes === true && (
                                <Caption style={{ color: '#f44336', marginTop: '8px' }}>
                                  ❌ Инициатива отклонена голосованием
                                </Caption>
                              )}
                            </>
                          )}
                          
                          {user.role === 'council_member' && init.responsible_id === user.id && (
                            <Caption style={{ color: '#2196f3', marginTop: '8px' }}>
                              👤 Вы назначены ответственным за эту инициативу
                            </Caption>
                          )}
                          
                          {(init.author_id === user.id || init.responsible_id === user.id || user.role === 'chairman') && !init.rejected_by_votes && (
                            <Button 
                              size="s" 
                              mode="outline" 
                              onClick={() => {
                                openChat(init);
                                markMessagesAsRead(init.id);
                              }} 
                              style={{ marginTop: '12px', position: 'relative' }}
                            >
                              💬 Обсуждение
                              {unreadMessages[init.id] > 0 && (
                                <span style={{
                                  position: 'absolute',
                                  top: '-5px',
                                  right: '-5px',
                                  background: '#f44336',
                                  color: 'white',
                                  borderRadius: '50%',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  {unreadMessages[init.id]}
                                </span>
                              )}
                            </Button>
                          )}
                          
                          {init.category === 'entrepreneurial' && (
                            <TeamRoles
                              initiative={init}
                              currentUser={user}
                              teamRoles={teamRoles[init.id]}
                              onJoinRole={handleJoinRole}
                              onCloseRole={handleCloseRole}
                              onOpenRole={handleOpenRole}
                              isInFeed={false}
                            />
                          )}
                          
                          <StatusManager 
                            initiative={init} 
                            userId={user.id}
                            onStatusChange={handleStatusChange}
                          />
                        </Div>
                      </Card>
                    ))
                  )}
                </Div>
              </Group>
            )}
            
            <Tabbar>
              <TabbarItem selected={activeTab === 'feed'} onClick={() => setActiveTab('feed')} text="Лента"><Icon28Newsfeed /></TabbarItem>
              <TabbarItem selected={activeTab === 'new'} onClick={() => setActiveTab('new')} text="Создать"><Icon28AddSquareOutline /></TabbarItem>
              <TabbarItem selected={activeTab === 'profile'} onClick={() => setActiveTab('profile')} text="Профиль"><Icon28UserOutline /></TabbarItem>
            </Tabbar>
          </Panel>
        </View>
        
        {notificationModal.open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', width: '300px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button mode="outline" onClick={() => setNotificationModal({ open: false, text: '', type: 'default' })} style={{ minWidth: 'auto', padding: '4px 8px', color: '#000', borderColor: '#ccc' }}>✕</Button>
              </div>
              <Title level="3" style={{ marginBottom: '16px' }}>{notificationModal.type === 'error' ? '❌ Ошибка' : '✅ Уведомление'}</Title>
              <Text style={{ marginBottom: '20px' }}>{notificationModal.text}</Text>
              <Button size="l" stretched mode="primary" onClick={() => setNotificationModal({ open: false, text: '', type: 'default' })}>ОК</Button>
            </div>
          </div>
        )}
        
        {rejectModal.open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', width: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button mode="outline" onClick={() => { setRejectModal({ open: false, initiativeId: null }); setRejectReason(''); }} style={{ minWidth: 'auto', padding: '4px 8px', color: '#000', borderColor: '#ccc' }}>✕</Button>
              </div>
              <Title level="3" style={{ marginBottom: '16px' }}>❌ Отклонить инициативу</Title>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Укажите причину отклонения..." rows={4} style={{ marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button size="l" stretched mode="primary" onClick={() => handleReject(rejectModal.initiativeId)} style={{ background: '#f44336', borderColor: '#f44336' }}>Отклонить</Button>
                <Button size="l" stretched mode="outline" onClick={() => { setRejectModal({ open: false, initiativeId: null }); setRejectReason(''); }}>Отмена</Button>
              </div>
            </div>
          </div>
        )}
        
        {reworkModal.open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', width: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button mode="outline" onClick={() => { setReworkModal({ open: false, initiativeId: null }); setReworkReason(''); }} style={{ minWidth: 'auto', padding: '4px 8px', color: '#000', borderColor: '#ccc' }}>✕</Button>
              </div>
              <Title level="3" style={{ marginBottom: '16px' }}>🔄 Отправить на доработку</Title>
              <Textarea value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} placeholder="Укажите, что нужно исправить..." rows={4} style={{ marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button size="l" stretched mode="primary" onClick={() => handleRework(reworkModal.initiativeId)} style={{ background: '#ff9800', borderColor: '#ff9800' }}>Отправить</Button>
                <Button size="l" stretched mode="outline" onClick={() => { setReworkModal({ open: false, initiativeId: null }); setReworkReason(''); }}>Отмена</Button>
              </div>
            </div>
          </div>
        )}
        
        {chatModal.open && (
          <ChatModal
            initiative={chatModal.initiative}
            currentUser={user}
            messages={chatMessages}
            loading={chatLoading}
            unreadCount={unreadMessages[chatModal.initiative?.id] || 0}
            onClose={() => setChatModal({ open: false, initiative: null })}
            onSendMessage={sendMessage}
            onMarkAsRead={markMessagesAsRead}
          />
        )}
      </AppRoot>
    </ConfigProvider>
  );
}

export default App;