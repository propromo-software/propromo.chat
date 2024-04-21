INSERT INTO users (name, email, password, auth_type)
VALUES ('John Doe', 'j.froe@gmx.at', 'password', 'local');

SELECT id INTO user_id FROM users WHERE email = 'j.froe@gmx.at';

INSERT INTO monitors (monitor_hash, project_identification)
VALUES ('w32tgse', 12345);

SELECT id INTO monitor_id FROM monitors WHERE monitor_hash = 'w32tgse';

INSERT INTO monitor_user (user_id, monitor_id)
VALUES (user_id, monitor_id);

SELECT user_id FROM monitor_user mu
      LEFT JOIN users u ON mu.user_id = u.id
      LEFT JOIN monitors m ON mu.monitor_id = m.id
      WHERE u.email = 'j.froe@gmx.at'
      AND u.password = 'password'
      AND m.monitor_hash = 'w32tgse';

INSERT INTO users (name, email, password, auth_type)
VALUES ('New User', 'newuser@example.com', 'newpassword', 'local');

SELECT id INTO new_user_id FROM users WHERE email = 'newuser@example.com';

INSERT INTO monitor_user (user_id, monitor_id)
VALUES (new_user_id, monitor_id);

SELECT user_id FROM monitor_user mu
      LEFT JOIN users u ON mu.user_id = u.id
      LEFT JOIN monitors m ON mu.monitor_id = m.id
      WHERE u.email = 'newuser@example.com'
      AND u.password = 'newpassword'
      AND m.monitor_hash = 'w32tgse';
