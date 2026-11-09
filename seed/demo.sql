-- Fictional demo Mission Day for local development. Apply with: npm run seed:local
-- The city does not exist and its portals sit in open sea, around latitude 0, longitude 0.

DELETE FROM mission_days WHERE slug = 'example-2027';
INSERT OR IGNORE INTO organisers (email, codename, faction) VALUES ('dev@example.org', 'DemoAgent', 'RES');
INSERT INTO mission_days (id, slug, city, year, format) VALUES ('demo-md', 'example-2027', 'Exampleville', 2027, 'standard18');
INSERT INTO memberships (mission_day_id, organiser_email, role) VALUES ('demo-md', 'dev@example.org', 'owner');

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-01', 'demo-md', 'Old Bridge', '{"en":"A short walk around Old Bridge in Exampleville."}', 1, 1, '#e6194b');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-01', 0, 'Old Bridge 1', 0.000000, 0.001500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-01', 1, 'Old Bridge 2', 0.002162, 0.001910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-01', 2, 'Old Bridge 3', 0.003164, 0.001576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-01', 3, 'Old Bridge 4', 0.002912, 0.001815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-01', 4, 'Old Bridge 5', 0.002465, 0.003420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-01', 5, 'Old Bridge 6', 0.003062, 0.005925);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-02', 'demo-md', 'Clock Tower', '{"en":"A short walk around Clock Tower in Exampleville."}', 1, 2, '#3cb44b');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 0, 'Clock Tower 1', 0.000000, 0.021500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 1, 'Clock Tower 2', 0.002162, 0.021910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 2, 'Clock Tower 3', 0.003164, 0.021576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 3, 'Clock Tower 4', 0.002912, 0.021815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 4, 'Clock Tower 5', 0.002465, 0.023420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 5, 'Clock Tower 6', 0.003062, 0.025925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-02', 6, 'Clock Tower 7', 0.004981, 0.028040);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-03', 'demo-md', 'River Walk', '{"en":"A short walk around River Walk in Exampleville."}', 1, 3, '#4363d8');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 0, 'River Walk 1', 0.000000, 0.041500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 1, 'River Walk 2', 0.002162, 0.041910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 2, 'River Walk 3', 0.003164, 0.041576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 3, 'River Walk 4', 0.002912, 0.041815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 4, 'River Walk 5', 0.002465, 0.043420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 5, 'River Walk 6', 0.003062, 0.045925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 6, 'River Walk 7', 0.004981, 0.048040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-03', 7, 'River Walk 8', 0.007285, 0.048831);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-04', 'demo-md', 'Market Square', '{"en":"A short walk around Market Square in Exampleville."}', 1, 4, '#f58231');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 0, 'Market Square 1', 0.000000, 0.061500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 1, 'Market Square 2', 0.002162, 0.061910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 2, 'Market Square 3', 0.003164, 0.061576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 3, 'Market Square 4', 0.002912, 0.061815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 4, 'Market Square 5', 0.002465, 0.063420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 5, 'Market Square 6', 0.003062, 0.065925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 6, 'Market Square 7', 0.004981, 0.068040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 7, 'Market Square 8', 0.007285, 0.068831);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-04', 8, 'Market Square 9', 0.008684, 0.068582);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-05', 'demo-md', 'Town Hall', '{"en":"A short walk around Town Hall in Exampleville."}', 1, 5, '#911eb4');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-05', 0, 'Town Hall 1', 0.000000, 0.081500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-05', 1, 'Town Hall 2', 0.002162, 0.081910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-05', 2, 'Town Hall 3', 0.003164, 0.081576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-05', 3, 'Town Hall 4', 0.002912, 0.081815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-05', 4, 'Town Hall 5', 0.002465, 0.083420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-05', 5, 'Town Hall 6', 0.003062, 0.085925);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-06', 'demo-md', 'Lighthouse', '{"en":"A short walk around Lighthouse in Exampleville."}', 1, 6, '#008080');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 0, 'Lighthouse 1', 0.020000, 0.001500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 1, 'Lighthouse 2', 0.022162, 0.001910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 2, 'Lighthouse 3', 0.023164, 0.001576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 3, 'Lighthouse 4', 0.022912, 0.001815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 4, 'Lighthouse 5', 0.022465, 0.003420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 5, 'Lighthouse 6', 0.023062, 0.005925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-06', 6, 'Lighthouse 7', 0.024981, 0.008040);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-07', 'demo-md', 'Botanic Garden', '{"en":"A short walk around Botanic Garden in Exampleville."}', 1, 7, '#f032e6');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 0, 'Botanic Garden 1', 0.020000, 0.021500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 1, 'Botanic Garden 2', 0.022162, 0.021910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 2, 'Botanic Garden 3', 0.023164, 0.021576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 3, 'Botanic Garden 4', 0.022912, 0.021815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 4, 'Botanic Garden 5', 0.022465, 0.023420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 5, 'Botanic Garden 6', 0.023062, 0.025925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 6, 'Botanic Garden 7', 0.024981, 0.028040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-07', 7, 'Botanic Garden 8', 0.027285, 0.028831);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-08', 'demo-md', 'Stone Gate', '{"en":"A short walk around Stone Gate in Exampleville."}', 1, 8, '#9a6324');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 0, 'Stone Gate 1', 0.020000, 0.041500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 1, 'Stone Gate 2', 0.022162, 0.041910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 2, 'Stone Gate 3', 0.023164, 0.041576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 3, 'Stone Gate 4', 0.022912, 0.041815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 4, 'Stone Gate 5', 0.022465, 0.043420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 5, 'Stone Gate 6', 0.023062, 0.045925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 6, 'Stone Gate 7', 0.024981, 0.048040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 7, 'Stone Gate 8', 0.027285, 0.048831);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-08', 8, 'Stone Gate 9', 0.028684, 0.048582);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-09', 'demo-md', 'Harbour Front', '{"en":"A short walk around Harbour Front in Exampleville."}', 1, 9, '#800000');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-09', 0, 'Harbour Front 1', 0.020000, 0.061500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-09', 1, 'Harbour Front 2', 0.022162, 0.061910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-09', 2, 'Harbour Front 3', 0.023164, 0.061576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-09', 3, 'Harbour Front 4', 0.022912, 0.061815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-09', 4, 'Harbour Front 5', 0.022465, 0.063420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-09', 5, 'Harbour Front 6', 0.023062, 0.065925);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-10', 'demo-md', 'Theatre Row', '{"en":"A short walk around Theatre Row in Exampleville."}', 1, 10, '#808000');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 0, 'Theatre Row 1', 0.020000, 0.081500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 1, 'Theatre Row 2', 0.022162, 0.081910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 2, 'Theatre Row 3', 0.023164, 0.081576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 3, 'Theatre Row 4', 0.022912, 0.081815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 4, 'Theatre Row 5', 0.022465, 0.083420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 5, 'Theatre Row 6', 0.023062, 0.085925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-10', 6, 'Theatre Row 7', 0.024981, 0.088040);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-11', 'demo-md', 'Mill Quarter', '{"en":"A short walk around Mill Quarter in Exampleville."}', 1, 11, '#000075');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 0, 'Mill Quarter 1', 0.040000, 0.001500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 1, 'Mill Quarter 2', 0.042162, 0.001910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 2, 'Mill Quarter 3', 0.043164, 0.001576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 3, 'Mill Quarter 4', 0.042912, 0.001815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 4, 'Mill Quarter 5', 0.042465, 0.003420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 5, 'Mill Quarter 6', 0.043062, 0.005925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 6, 'Mill Quarter 7', 0.044981, 0.008040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-11', 7, 'Mill Quarter 8', 0.047285, 0.008831);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-12', 'demo-md', 'Cathedral Hill', '{"en":"A short walk around Cathedral Hill in Exampleville."}', 1, 12, '#469990');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 0, 'Cathedral Hill 1', 0.040000, 0.021500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 1, 'Cathedral Hill 2', 0.042162, 0.021910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 2, 'Cathedral Hill 3', 0.043164, 0.021576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 3, 'Cathedral Hill 4', 0.042912, 0.021815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 4, 'Cathedral Hill 5', 0.042465, 0.023420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 5, 'Cathedral Hill 6', 0.043062, 0.025925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 6, 'Cathedral Hill 7', 0.044981, 0.028040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 7, 'Cathedral Hill 8', 0.047285, 0.028831);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-12', 8, 'Cathedral Hill 9', 0.048684, 0.028582);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-13', 'demo-md', 'Railway Park', '{"en":"A short walk around Railway Park in Exampleville."}', 1, 13, '#dc143c');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-13', 0, 'Railway Park 1', 0.040000, 0.041500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-13', 1, 'Railway Park 2', 0.042162, 0.041910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-13', 2, 'Railway Park 3', 0.043164, 0.041576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-13', 3, 'Railway Park 4', 0.042912, 0.041815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-13', 4, 'Railway Park 5', 0.042465, 0.043420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-13', 5, 'Railway Park 6', 0.043062, 0.045925);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-14', 'demo-md', 'Fishermen Quay', '{"en":"A short walk around Fishermen Quay in Exampleville."}', 1, 14, '#2e8b57');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 0, 'Fishermen Quay 1', 0.040000, 0.061500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 1, 'Fishermen Quay 2', 0.042162, 0.061910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 2, 'Fishermen Quay 3', 0.043164, 0.061576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 3, 'Fishermen Quay 4', 0.042912, 0.061815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 4, 'Fishermen Quay 5', 0.042465, 0.063420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 5, 'Fishermen Quay 6', 0.043062, 0.065925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-14', 6, 'Fishermen Quay 7', 0.044981, 0.068040);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-15', 'demo-md', 'Museum Mile', '{"en":"A short walk around Museum Mile in Exampleville."}', 1, 15, '#1e90ff');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 0, 'Museum Mile 1', 0.040000, 0.081500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 1, 'Museum Mile 2', 0.042162, 0.081910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 2, 'Museum Mile 3', 0.043164, 0.081576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 3, 'Museum Mile 4', 0.042912, 0.081815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 4, 'Museum Mile 5', 0.042465, 0.083420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 5, 'Museum Mile 6', 0.043062, 0.085925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 6, 'Museum Mile 7', 0.044981, 0.088040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-15', 7, 'Museum Mile 8', 0.047285, 0.088831);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-16', 'demo-md', 'Castle Steps', '{"en":"A short walk around Castle Steps in Exampleville."}', 1, 16, '#ff8c00');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 0, 'Castle Steps 1', 0.060000, 0.001500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 1, 'Castle Steps 2', 0.062162, 0.001910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 2, 'Castle Steps 3', 0.063164, 0.001576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 3, 'Castle Steps 4', 0.062912, 0.001815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 4, 'Castle Steps 5', 0.062465, 0.003420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 5, 'Castle Steps 6', 0.063062, 0.005925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 6, 'Castle Steps 7', 0.064981, 0.008040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 7, 'Castle Steps 8', 0.067285, 0.008831);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-16', 8, 'Castle Steps 9', 0.068684, 0.008582);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-17', 'demo-md', 'Windmill Lane', '{"en":"A short walk around Windmill Lane in Exampleville."}', 1, 17, '#8a2be2');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-17', 0, 'Windmill Lane 1', 0.060000, 0.021500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-17', 1, 'Windmill Lane 2', 0.062162, 0.021910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-17', 2, 'Windmill Lane 3', 0.063164, 0.021576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-17', 3, 'Windmill Lane 4', 0.062912, 0.021815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-17', 4, 'Windmill Lane 5', 0.062465, 0.023420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-17', 5, 'Windmill Lane 6', 0.063062, 0.025925);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-18', 'demo-md', 'University Yard', '{"en":"A short walk around University Yard in Exampleville."}', 1, 18, '#20b2aa');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 0, 'University Yard 1', 0.060000, 0.041500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 1, 'University Yard 2', 0.062162, 0.041910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 2, 'University Yard 3', 0.063164, 0.041576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 3, 'University Yard 4', 0.062912, 0.041815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 4, 'University Yard 5', 0.062465, 0.043420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 5, 'University Yard 6', 0.063062, 0.045925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-18', 6, 'University Yard 7', 0.064981, 0.048040);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-19', 'demo-md', 'Fountain Court', '{"en":"A short walk around Fountain Court in Exampleville."}', 0, NULL, '#c71585');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 0, 'Fountain Court 1', 0.060000, 0.061500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 1, 'Fountain Court 2', 0.062162, 0.061910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 2, 'Fountain Court 3', 0.063164, 0.061576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 3, 'Fountain Court 4', 0.062912, 0.061815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 4, 'Fountain Court 5', 0.062465, 0.063420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 5, 'Fountain Court 6', 0.063062, 0.065925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 6, 'Fountain Court 7', 0.064981, 0.068040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-19', 7, 'Fountain Court 8', 0.067285, 0.068831);

INSERT INTO missions (id, mission_day_id, landmark, description_json, selected, recommended_order, colour) VALUES ('demo-mission-20', 'demo-md', 'North Pier', '{"en":"A short walk around North Pier in Exampleville."}', 0, NULL, '#a0522d');
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 0, 'North Pier 1', 0.060000, 0.081500);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 1, 'North Pier 2', 0.062162, 0.081910);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 2, 'North Pier 3', 0.063164, 0.081576);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 3, 'North Pier 4', 0.062912, 0.081815);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 4, 'North Pier 5', 0.062465, 0.083420);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 5, 'North Pier 6', 0.063062, 0.085925);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 6, 'North Pier 7', 0.064981, 0.088040);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 7, 'North Pier 8', 0.067285, 0.088831);
INSERT INTO waypoints (mission_id, position, title, lat, lng) VALUES ('demo-mission-20', 8, 'North Pier 9', 0.068684, 0.088582);
