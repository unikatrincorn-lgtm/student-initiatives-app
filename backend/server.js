const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { checkRequestSignature } = require('vk-helpers');

const app = express();
const port = 3001;

const VK_APP_SECRET = 'oY4k3T67POGYEK9LtSVb';
const VK_APP_ID = 54625831;

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5434,
  database: 'initiatives_db',
});

app.use(cors());
app.use(express.json());

pool.connect((err) => {
  if (err) console.error('❌ Ошибка подключения к БД:', err);
  else console.log('✅ Подключено к PostgreSQL');
});

// ==================== API ИНИЦИАТИВ ====================

app.get('/api/initiatives', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, u.first_name, u.last_name 
       FROM initiatives i
       JOIN users u ON i.author_id = u.id
       WHERE i.is_published = true AND i.rejected_by_votes = false
       ORDER BY i.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-initiatives', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Не указан user_id' });
  try {
    const result = await pool.query(
      `SELECT i.*, u.first_name, u.last_name 
       FROM initiatives i
       JOIN users u ON i.author_id = u.id
       WHERE i.author_id = $1 
       ORDER BY i.updated_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/initiatives', async (req, res) => {
  const { title, description, category, expected_result, author_id, roles_needed, contact_info } = req.body;
  if (!author_id) return res.status(400).json({ error: 'Не указан автор' });
  try {
    let query, params;
    if (category === 'entrepreneurial') {
      query = `INSERT INTO initiatives (title, description, category, expected_result, status, author_id, roles_needed, contact_info, is_published) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING *`;
      params = [title, description, category, expected_result || 'Ожидается реализация', 'На модерации', author_id, roles_needed || null, contact_info || null];
    } else {
      query = `INSERT INTO initiatives (title, description, category, expected_result, status, author_id, is_published) 
               VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING *`;
      params = [title, description, category, expected_result || 'Ожидается реализация', 'На модерации', author_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/initiatives/:id/publish', async (req, res) => {
  const { id } = req.params;
  const { user_role } = req.body;
  if (user_role !== 'chairman') return res.status(403).json({ error: 'Недостаточно прав' });
  try {
    const result = await pool.query(
      'UPDATE initiatives SET is_published = true, status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['На голосовании', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/initiatives/:id/accept', async (req, res) => {
  const { id } = req.params;
  const { user_role } = req.body;
  if (user_role !== 'chairman') return res.status(403).json({ error: 'Недостаточно прав' });
  try {
    const result = await pool.query(
      'UPDATE initiatives SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['На рассмотрении', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/initiatives/:id/responsible', async (req, res) => {
  const { id } = req.params;
  const { responsible_id, user_role } = req.body;
  if (user_role !== 'chairman') return res.status(403).json({ error: 'Недостаточно прав' });
  try {
    const result = await pool.query(
      'UPDATE initiatives SET responsible_id = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [responsible_id, 'На рассмотрении', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/initiatives/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason, user_id, user_role } = req.body;
  try {
    const initiative = await pool.query('SELECT responsible_id FROM initiatives WHERE id = $1', [id]);
    if (initiative.rows.length === 0) return res.status(404).json({ error: 'Инициатива не найдена' });
    let hasAccess = false;
    if (user_role === 'chairman') hasAccess = true;
    else if (initiative.rows[0].responsible_id === user_id) hasAccess = true;
    if (!hasAccess) return res.status(403).json({ error: 'Недостаточно прав' });
    const result = await pool.query(
      'UPDATE initiatives SET status = $1, rejection_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [status, rejection_reason || null, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/responsible-initiatives', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Не указан user_id' });
  try {
    const result = await pool.query(
      `SELECT i.*, u.first_name, u.last_name 
       FROM initiatives i
       JOIN users u ON i.author_id = u.id
       WHERE i.responsible_id = $1 
       ORDER BY i.updated_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/unpublished-initiatives', async (req, res) => {
  const { user_role } = req.query;
  if (user_role !== 'chairman') return res.status(403).json({ error: 'Недостаточно прав' });
  try {
    const result = await pool.query(
      `SELECT i.*, u.first_name, u.last_name 
       FROM initiatives i
       JOIN users u ON i.author_id = u.id
       WHERE i.is_published = false 
         AND i.rejected_by_votes = false
         AND (i.status = 'На модерации' OR i.status = 'Принята к реализации' OR i.status = 'На рассмотрении' OR i.status = 'Команда собрана')
       ORDER BY i.updated_at DESC`
    );
    console.log(`📋 Председатель: загружено ${result.rows.length} неопубликованных инициатив`);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения неопубликованных инициатив:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/accepted-initiatives', async (req, res) => {
  const { user_role } = req.query;
  if (user_role !== 'chairman') return res.status(403).json({ error: 'Недостаточно прав' });
  try {
    const result = await pool.query(
      `SELECT i.*, u.first_name, u.last_name 
       FROM initiatives i
       JOIN users u ON i.author_id = u.id
       WHERE i.status = 'Принята к реализации' 
         AND i.rejected_by_votes = false
         AND i.is_published = false
       ORDER BY i.updated_at DESC`
    );
    console.log(`📋 Председатель: загружено ${result.rows.length} принятых инициатив`);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения принятых инициатив:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== API ДЛЯ ОТКЛОНЁННЫХ ИНИЦИАТИВ ====================

app.get('/api/rejected-initiatives', async (req, res) => {
  const { user_id, user_role } = req.query;
  
  try {
    let query;
    if (user_role === 'chairman') {
      query = `SELECT i.*, u.first_name, u.last_name 
               FROM initiatives i
               JOIN users u ON i.author_id = u.id
               WHERE i.rejected_by_votes = true OR i.status = 'Отклонена голосованием'
               ORDER BY i.updated_at DESC`;
      const result = await pool.query(query);
      res.json(result.rows);
    } else {
      query = `SELECT i.*, u.first_name, u.last_name 
               FROM initiatives i
               JOIN users u ON i.author_id = u.id
               WHERE (i.rejected_by_votes = true OR i.status = 'Отклонена голосованием') AND i.author_id = $1
               ORDER BY i.updated_at DESC`;
      const result = await pool.query(query, [user_id]);
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Ошибка получения отклонённых инициатив:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== API ГОЛОСОВАНИЯ ====================

app.post('/api/votes', async (req, res) => {
  const { initiative_id, user_id, vote_value } = req.body;
  if (!initiative_id || !user_id || !vote_value) {
    return res.status(400).json({ error: 'Недостаточно данных' });
  }
  try {
    const existingVote = await pool.query(
      'SELECT vote_value FROM votes WHERE initiative_id = $1 AND user_id = $2',
      [initiative_id, user_id]
    );
    
    let oldVoteValue = null;
    if (existingVote.rows.length > 0) {
      oldVoteValue = existingVote.rows[0].vote_value;
    }
    
    if (oldVoteValue === 'for') {
      await pool.query('UPDATE initiatives SET for_votes = for_votes - 1 WHERE id = $1', [initiative_id]);
    } else if (oldVoteValue === 'against') {
      await pool.query('UPDATE initiatives SET against_votes = against_votes - 1 WHERE id = $1', [initiative_id]);
    }
    
    if (vote_value === 'for') {
      await pool.query('UPDATE initiatives SET for_votes = for_votes + 1 WHERE id = $1', [initiative_id]);
    } else if (vote_value === 'against') {
      await pool.query('UPDATE initiatives SET against_votes = against_votes + 1 WHERE id = $1', [initiative_id]);
    }
    
    await pool.query('DELETE FROM votes WHERE initiative_id = $1 AND user_id = $2', [initiative_id, user_id]);
    const result = await pool.query(
      'INSERT INTO votes (initiative_id, user_id, vote_value) VALUES ($1, $2, $3) RETURNING *',
      [initiative_id, user_id, vote_value]
    );
    
    const updatedCounts = await pool.query(
      'SELECT for_votes, against_votes, is_published, status, category, rejected_by_votes FROM initiatives WHERE id = $1',
      [initiative_id]
    );
    const counts = updatedCounts.rows[0];
    
    console.log(`📊 Инициатива ${initiative_id}: ЗА=${counts.for_votes}, ПРОТИВ=${counts.against_votes}, опубликована=${counts.is_published}, категория=${counts.category}`);
    
    if (counts.category !== 'entrepreneurial') {
      if (counts.for_votes >= 2 && counts.is_published === true) {
        await pool.query(
          `UPDATE initiatives 
           SET is_published = false, 
               status = 'Принята к реализации', 
               rejected_by_votes = false,
               accepted_by_votes = true,
               updated_at = NOW() 
           WHERE id = $1`,
          [initiative_id]
        );
        console.log(`📢 Инициатива ${initiative_id} получила ${counts.for_votes} голосов ЗА, отправлена председателю`);
      }
      
      if (counts.against_votes >= 2 && counts.is_published === true) {
        await pool.query(
          `UPDATE initiatives 
           SET is_published = false, 
               status = 'Отклонена голосованием', 
               rejected_by_votes = true,
               accepted_by_votes = false,
               updated_at = NOW() 
           WHERE id = $1`,
          [initiative_id]
        );
        console.log(`❌ Инициатива ${initiative_id} получила ${counts.against_votes} голосов ПРОТИВ, отклонена`);
      }
    }
    
    res.json({ 
      success: true, 
      vote: result.rows[0],
      for_votes: counts.for_votes,
      against_votes: counts.against_votes
    });
  } catch (err) {
    console.error('Ошибка голосования:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/votes/:initiativeId', async (req, res) => {
  const { initiativeId } = req.params;
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(CASE WHEN vote_value = 'for' THEN 1 END) as for_count,
        COUNT(CASE WHEN vote_value = 'against' THEN 1 END) as against_count
       FROM votes WHERE initiative_id = $1`,
      [initiativeId]
    );
    const voters = await pool.query(
      `SELECT v.*, u.first_name, u.last_name, u.role
       FROM votes v
       JOIN users u ON v.user_id = u.id
       WHERE v.initiative_id = $1
       ORDER BY v.created_at DESC`,
      [initiativeId]
    );
    res.json({
      for_count: parseInt(stats.rows[0].for_count) || 0,
      against_count: parseInt(stats.rows[0].against_count) || 0,
      voters: voters.rows
    });
  } catch (err) {
    console.error('Ошибка получения статистики:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/votes/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT initiative_id, vote_value FROM votes WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения голосов пользователя:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/check-votes/:initiativeId', async (req, res) => {
  const { initiativeId } = req.params;
  try {
    const result = await pool.query(
      'SELECT for_votes, against_votes, is_published, status, rejected_by_votes, accepted_by_votes FROM initiatives WHERE id = $1',
      [initiativeId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== API ДЛЯ ОБНОВЛЕНИЯ СЧЁТЧИКОВ ====================

app.post('/api/update-vote-counts', async (req, res) => {
  try {
    await pool.query(`
      UPDATE initiatives i
      SET for_votes = COALESCE((
        SELECT COUNT(*) FROM votes v 
        WHERE v.initiative_id = i.id AND v.vote_value = 'for'
      ), 0),
      against_votes = COALESCE((
        SELECT COUNT(*) FROM votes v 
        WHERE v.initiative_id = i.id AND v.vote_value = 'against'
      ), 0)
    `);
    res.json({ success: true, message: 'Счётчики обновлены' });
  } catch (err) {
    console.error('Ошибка обновления счётчиков:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== API ДЛЯ РОЛЕЙ В КОМАНДУ ====================

app.get('/api/team-roles/:initiativeId', async (req, res) => {
  const { initiativeId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM team_roles WHERE initiative_id = $1 ORDER BY id',
      [initiativeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения ролей:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team-roles', async (req, res) => {
  const { initiative_id, role_name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO team_roles (initiative_id, role_name, is_filled) VALUES ($1, $2, false) RETURNING *',
      [initiative_id, role_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка добавления роли:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/team-roles/:roleId/join', async (req, res) => {
  const { roleId } = req.params;
  const { user_id } = req.body;
  try {
    const roleCheck = await pool.query(
      'SELECT * FROM team_roles WHERE id = $1',
      [roleId]
    );
    
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }
    
    if (roleCheck.rows[0].is_filled) {
      return res.status(400).json({ error: 'Роль уже занята' });
    }
    
    const result = await pool.query(
      'UPDATE team_roles SET is_filled = true, filled_by = $1 WHERE id = $2 RETURNING *',
      [user_id, roleId]
    );
    
    const initiativeId = roleCheck.rows[0].initiative_id;
    const allRoles = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_filled THEN 1 ELSE 0 END) as filled FROM team_roles WHERE initiative_id = $1',
      [initiativeId]
    );
    
    if (allRoles.rows[0].total === allRoles.rows[0].filled) {
      await pool.query(
        'UPDATE initiatives SET is_published = false, status = $1, updated_at = NOW() WHERE id = $2',
        ['Команда собрана', initiativeId]
      );
      console.log(`🎉 Инициатива ${initiativeId}: все роли заполнены, инициатива реализована`);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка присоединения к роли:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/team-roles/:roleId/close', async (req, res) => {
  const { roleId } = req.params;
  const { user_id } = req.body;
  try {
    const roleCheck = await pool.query(
      `SELECT tr.*, i.author_id 
       FROM team_roles tr
       JOIN initiatives i ON tr.initiative_id = i.id
       WHERE tr.id = $1`,
      [roleId]
    );
    
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }
    
    if (roleCheck.rows[0].author_id !== user_id) {
      return res.status(403).json({ error: 'Только автор может закрыть роль' });
    }
    
    const result = await pool.query(
      'UPDATE team_roles SET is_filled = true, filled_by = $1 WHERE id = $2 RETURNING *',
      [user_id, roleId]
    );
    
    const initiativeId = roleCheck.rows[0].initiative_id;
    const allRoles = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_filled THEN 1 ELSE 0 END) as filled FROM team_roles WHERE initiative_id = $1',
      [initiativeId]
    );
    
    if (allRoles.rows[0].total === allRoles.rows[0].filled) {
      await pool.query(
        'UPDATE initiatives SET is_published = false, status = $1, updated_at = NOW() WHERE id = $2',
        ['Команда собрана', initiativeId]
      );
      console.log(`🎉 Инициатива ${initiativeId}: все роли заполнены, инициатива реализована`);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка закрытия роли:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/team-roles/:roleId/open', async (req, res) => {
  const { roleId } = req.params;
  const { user_id } = req.body;
  try {
    const roleCheck = await pool.query(
      `SELECT tr.*, i.author_id 
       FROM team_roles tr
       JOIN initiatives i ON tr.initiative_id = i.id
       WHERE tr.id = $1`,
      [roleId]
    );
    
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }
    
    if (roleCheck.rows[0].author_id !== user_id) {
      return res.status(403).json({ error: 'Только автор может открыть роль' });
    }
    
    const result = await pool.query(
      'UPDATE team_roles SET is_filled = false, filled_by = NULL WHERE id = $1 RETURNING *',
      [roleId]
    );
    
    const initiativeId = roleCheck.rows[0].initiative_id;
    
    const allRoles = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_filled THEN 1 ELSE 0 END) as filled FROM team_roles WHERE initiative_id = $1',
      [initiativeId]
    );
    
    if (allRoles.rows[0].filled < allRoles.rows[0].total) {
      await pool.query(
        'UPDATE initiatives SET is_published = true, status = $1, updated_at = NOW() WHERE id = $2',
        ['На голосовании', initiativeId]
      );
      console.log(`🔄 Инициатива ${initiativeId}: роль открыта, инициатива снова в ленте`);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка открытия роли:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/team-roles/:roleId/leave', async (req, res) => {
  const { roleId } = req.params;
  const { user_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE team_roles SET is_filled = false, filled_by = NULL WHERE id = $1 AND filled_by = $2 RETURNING *',
      [roleId, user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Вы не занимаете эту роль' });
    }
    
    const initiativeCheck = await pool.query(
      `SELECT initiative_id FROM team_roles WHERE id = $1`,
      [roleId]
    );
    const initiativeId = initiativeCheck.rows[0].initiative_id;
    
    await pool.query(
      'UPDATE initiatives SET is_published = true, status = $1, updated_at = NOW() WHERE id = $2',
      ['На голосовании', initiativeId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка отказа от роли:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== API СООБЩЕНИЙ (ЧАТ) ====================

app.get('/api/messages/:initiativeId', async (req, res) => {
  const { initiativeId } = req.params;
  try {
    const result = await pool.query(
      `SELECT m.*, u1.first_name as sender_first_name, u1.last_name as sender_last_name,
              u2.first_name as receiver_first_name, u2.last_name as receiver_last_name
       FROM messages m
       JOIN users u1 ON m.sender_id = u1.id
       LEFT JOIN users u2 ON m.receiver_id = u2.id
       WHERE m.initiative_id = $1
       ORDER BY m.created_at ASC`,
      [initiativeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', async (req, res) => {
  const { initiative_id, sender_id, receiver_id, message } = req.body;
  if (!initiative_id || !sender_id || !message) {
    return res.status(400).json({ error: 'Недостаточно данных' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO messages (initiative_id, sender_id, receiver_id, message) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [initiative_id, sender_id, receiver_id || null, message]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/unread-messages', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Не указан user_id' });
  try {
    const result = await pool.query(
      `SELECT initiative_id, COUNT(*) as unread_count
       FROM messages
       WHERE receiver_id = $1 AND is_read = false
       GROUP BY initiative_id`,
      [user_id]
    );
    const unread = {};
    result.rows.forEach(row => {
      unread[row.initiative_id] = parseInt(row.unread_count);
    });
    res.json(unread);
  } catch (err) {
    console.error('Ошибка получения непрочитанных:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/messages/read/:initiativeId', async (req, res) => {
  const { initiativeId } = req.params;
  const { user_id } = req.body;
  try {
    await pool.query(
      'UPDATE messages SET is_read = true WHERE initiative_id = $1 AND receiver_id = $2',
      [initiativeId, user_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отметки прочитанных:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== АВТОРИЗАЦИЯ VK ====================

app.post('/api/auth/vk', async (req, res) => {
  const { vk_id, first_name, last_name, sign, ts } = req.body;
  if (!vk_id || !sign || !ts) return res.status(400).json({ error: 'Недостаточно данных' });
  try {
    const isSignatureValid = checkRequestSignature({
      signature: sign,
      secretKey: VK_APP_SECRET,
      app_id: VK_APP_ID,
      params: { vk_user_id: String(vk_id), vk_user_name: first_name || '' },
      user_id: String(vk_id),
      ts: String(ts),
    });
    if (!isSignatureValid) return res.status(401).json({ error: 'Неверная подпись' });
    let result = await pool.query('SELECT * FROM users WHERE vk_id = $1', [vk_id]);
    let user;
    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO users (vk_id, first_name, last_name, role, group_name) 
         VALUES ($1, $2, $3, 'student', 'Не указана') RETURNING *`,
        [vk_id, first_name, last_name]
      );
      user = insertResult.rows[0];
    } else {
      user = result.rows[0];
      await pool.query('UPDATE users SET first_name = $1, last_name = $2 WHERE vk_id = $3', [first_name, last_name, vk_id]);
    }
    const token = Buffer.from(`${vk_id}:${Date.now()}`).toString('base64');
    res.json({ success: true, token, user: { id: user.id, vk_id: user.vk_id, first_name: user.first_name, last_name: user.last_name, role: user.role, group_name: user.group_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Сервер работает!' });
});

app.listen(port, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${port}`);
});