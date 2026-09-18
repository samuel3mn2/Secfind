# Verificación de autenticación existente

Alcance: corrección E722 en `get_optional_user`, capturando `HTTPException` de `get_current_user`. No se han cambiado credenciales, tokens ni el contrato JWT Bearer existente.

## Comprobaciones
1. Consultar `/app/memory/test_credentials.md` y usar la URL de `frontend/.env`.
2. En MongoDB, verificar el administrador de la colección `usuarios` y su hash bcrypt sin divulgarlo.
3. `POST /api/auth/login` con `username` y `password`: debe devolver el token y usuario existentes.
4. `GET /api/auth/me` con `Authorization: Bearer <token>`: debe devolver el mismo usuario.
5. Sin token o con token inválido: las rutas protegidas deben devolver 401.
6. `get_optional_user` devuelve `None` sin cabecera o ante `HTTPException`; un usuario válido se conserva.

La guía general contempla cookies, renovación de tokens e índices de usuarios por email; no aplican a esta corrección puntual del sistema existente basado en username y Bearer. No se modifica esa arquitectura.