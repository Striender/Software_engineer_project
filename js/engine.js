#!/usr/bin/env python3
"""
NEON DUEL 2v2 - Combined HTTP + WebSocket Server  WITH DATABASE
Single port 8080 — only ONE ngrok tunnel needed.
Python 3.6+, NO pip packages required.

HOW TO RUN:
  python3 server.py

EXPOSE WITH NGROK (just one terminal):
  ngrok http 8080

SHARE WITH PLAYERS:
  Game URL : https://XXXX.ngrok-free.app/index.html
  WS URL   : wss://XXXX.ngrok-free.app
"""

import asyncio, hashlib, base64, struct, json, sqlite3, time
import urllib.parse, os
from pathlib import Path

WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
rooms = {}   # room_code -> [(reader, writer, pid), ...]

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
DB_PATH = Path(__file__).parent / 'neonduel.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS players (
        name        TEXT PRIMARY KEY,
        wins        INTEGER DEFAULT 0,
        losses      INTEGER DEFAULT 0,
        kills       INTEGER DEFAULT 0,
        deaths      INTEGER DEFAULT 0,
        matches     INTEGER DEFAULT 0,
        rounds_won  INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS matches (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_team TEXT,
        team_a      TEXT,
        team_b      TEXT,
        score_a     INTEGER,
        score_b     INTEGER,
        rounds      INTEGER,
        mode        TEXT,
        played_at   TEXT DEFAULT (datetime('now'))
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS kill_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id    INTEGER,
        round_num   INTEGER,
        killer      TEXT,
        victim      TEXT,
        killer_char TEXT,
        victim_char TEXT,
        ts          TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(match_id) REFERENCES matches(id)
    )''')

    conn.commit()
    conn.close()
    print('[DB] Database ready:', DB_PATH)

def upsert_player(name, conn=None):
    own = conn is None
    if own: conn = get_db()
    conn.execute('INSERT OR IGNORE INTO players(name) VALUES(?)', (name,))
    if own: conn.commit(); conn.close()

def save_match(winner_team, team_a_names, team_b_names, score_a, score_b, rounds, mode):
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO matches(winner_team,team_a,team_b,score_a,score_b,rounds,mode)
                 VALUES(?,?,?,?,?,?,?)''',
              (winner_team, ','.join(team_a_names), ','.join(team_b_names),
               score_a, score_b, rounds, mode))
    match_id = c.lastrowid

    for name in team_a_names:
        upsert_player(name, conn)
        if winner_team == 'A':
            conn.execute('UPDATE players SET wins=wins+1, matches=matches+1, rounds_won=rounds_won+? WHERE name=?', (score_a, name))
        elif winner_team == 'B':
            conn.execute('UPDATE players SET losses=losses+1, matches=matches+1, rounds_won=rounds_won+? WHERE name=?', (score_a, name))
        else:
            conn.execute('UPDATE players SET matches=matches+1, rounds_won=rounds_won+? WHERE name=?', (score_a, name))

    for name in team_b_names:
        upsert_player(name, conn)
        if winner_team == 'B':
            conn.execute('UPDATE players SET wins=wins+1, matches=matches+1, rounds_won=rounds_won+? WHERE name=?', (score_b, name))
        elif winner_team == 'A':
            conn.execute('UPDATE players SET losses=losses+1, matches=matches+1, rounds_won=rounds_won+? WHERE name=?', (score_b, name))
        else:
            conn.execute('UPDATE players SET matches=matches+1, rounds_won=rounds_won+? WHERE name=?', (score_b, name))

    conn.commit()
    conn.close()
    print(f'[DB] Match #{match_id} — Team {winner_team} wins  A:{score_a} B:{score_b}')
    return match_id

def save_kill(match_id, round_num, killer, victim, killer_char='', victim_char=''):
    if not match_id: return
    conn = get_db()
    upsert_player(killer, conn)
    upsert_player(victim, conn)
    conn.execute('''INSERT INTO kill_log(match_id,round_num,killer,victim,killer_char,victim_char)
                    VALUES(?,?,?,?,?,?)''', (match_id, round_num, killer, victim, killer_char, victim_char))
    conn.execute('UPDATE players SET kills=kills+1 WHERE name=?', (killer,))
    conn.execute('UPDATE players SET deaths=deaths+1 WHERE name=?', (victim,))
    conn.commit()
    conn.close()

def get_leaderboard(limit=20):
    conn = get_db()
    rows = conn.execute('''
        SELECT name, wins, losses, kills, deaths, matches, rounds_won,
               CASE WHEN matches>0 THEN ROUND(100.0*wins/matches,1) ELSE 0 END as win_pct,
               CASE WHEN deaths>0  THEN ROUND(1.0*kills/deaths,2)   ELSE kills END as kd
        FROM players WHERE matches > 0
        ORDER BY wins DESC, kd DESC LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_match_history(limit=20):
    conn = get_db()
    rows = conn.execute('''
        SELECT id, winner_team, team_a, team_b, score_a, score_b, rounds, mode, played_at
        FROM matches ORDER BY id DESC LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_player_profile(name):
    conn = get_db()
    p = conn.execute('SELECT * FROM players WHERE name=?', (name,)).fetchone()
    if not p: conn.close(); return None
    p = dict(p)
    kills = conn.execute('''
        SELECT victim, killer_char, ts FROM kill_log WHERE killer=? ORDER BY id DESC LIMIT 10
    ''', (name,)).fetchall()
    p['recent_kills'] = [dict(k) for k in kills]
    ms = conn.execute('''
        SELECT * FROM matches WHERE team_a LIKE ? OR team_b LIKE ? ORDER BY id DESC LIMIT 10
    ''', (f'%{name}%', f'%{name}%')).fetchall()
    p['recent_matches'] = [dict(m) for m in ms]
    conn.close()
    return p

def get_kill_feed(limit=50):
    conn = get_db()
    rows = conn.execute('''
        SELECT k.killer, k.victim, k.killer_char, k.victim_char, k.round_num, k.ts
        FROM kill_log k ORDER BY k.id DESC LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Room state tracker ─────────────────────────────────────────
# room_code -> {match_id, round, lobby, mode}
room_state = {}

# ═══════════════════════════════════════════════════════════════
# WEBSOCKET HELPERS
# ═══════════════════════════════════════════════════════════════
def ws_accept(key):
    sha = hashlib.sha1((key + WS_MAGIC).encode()).digest()
    return base64.b64encode(sha).decode()

async def recv_frame(reader):
    try:
        h = await reader.readexactly(2)
    except Exception:
        return None, None
    opcode = h[0] & 0x0f
    masked = bool(h[1] & 0x80)
    length = h[1] & 0x7f
    if length == 126: length = struct.unpack('>H', await reader.readexactly(2))[0]
    elif length == 127: length = struct.unpack('>Q', await reader.readexactly(8))[0]
    mask = await reader.readexactly(4) if masked else None
    data = await reader.readexactly(length)
    if masked: data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    return opcode, data

def ws_frame(text):
    data = text.encode()
    n = len(data)
    hdr = (bytes([0x81, n]) if n < 126 else
           bytes([0x81, 126]) + struct.pack('>H', n) if n < 65536 else
           bytes([0x81, 127]) + struct.pack('>Q', n))
    return hdr + data

async def ws_send(writer, text):
    writer.write(ws_frame(text))
    await writer.drain()

# ═══════════════════════════════════════════════════════════════
# CONNECTION HANDLER
# ═══════════════════════════════════════════════════════════════
async def handle(reader, writer):
    raw = b''
    while b'\r\n\r\n' not in raw:
        chunk = await reader.read(4096)
        if not chunk: writer.close(); return
        raw += chunk

    head, _, rest = raw.partition(b'\r\n\r\n')
    first_line = head.split(b'\r\n')[0].decode(errors='replace')
    headers = {}
    for line in head.split(b'\r\n')[1:]:
        if b':' in line:
            k, v = line.split(b':', 1)
            headers[k.strip().lower().decode()] = v.strip().decode()

    if headers.get('upgrade', '').lower() == 'websocket':
        await handle_ws(reader, writer, headers)
    else:
        await handle_http(reader, writer, first_line, headers, rest)

# ═══════════════════════════════════════════════════════════════
# HTTP + API HANDLER
# ═══════════════════════════════════════════════════════════════
MIME = {'.html':'text/html', '.js':'application/javascript',
        '.css':'text/css', '.png':'image/png', '.ico':'image/x-icon'}
BASE_DIR = Path(__file__).parent.parent

def json_resp(writer, data_obj, status=200):
    data = json.dumps(data_obj).encode()
    status_text = '200 OK' if status == 200 else '404 Not Found'
    return (f'HTTP/1.1 {status_text}\r\nContent-Type: application/json\r\n'
            f'Access-Control-Allow-Origin: *\r\n'
            f'Content-Length: {len(data)}\r\nConnection: close\r\n\r\n').encode() + data

async def handle_http(reader, writer, first_line, headers, body):
    try: method, path, _ = first_line.split()
    except ValueError: writer.close(); return

    path = urllib.parse.unquote(path.split('?')[0])

    # ── REST API ──────────────────────────────────────────
    if path == '/api/leaderboard':
        writer.write(json_resp(writer, get_leaderboard()))
    elif path == '/api/matches':
        writer.write(json_resp(writer, get_match_history()))
    elif path == '/api/kills':
        writer.write(json_resp(writer, get_kill_feed()))
    elif path.startswith('/api/player/'):
        name = urllib.parse.unquote(path[len('/api/player/'):]).upper()
        profile = get_player_profile(name)
        writer.write(json_resp(writer, profile if profile else {'error': 'Player not found'}, 200 if profile else 404))
    else:
        # ── Static files ──────────────────────────────────
        if path == '/': path = '/index.html'
        filepath = BASE_DIR / path.lstrip('/')
        if filepath.exists() and filepath.is_file():
            data = filepath.read_bytes()
            ext  = filepath.suffix.lower()
            mime = MIME.get(ext, 'application/octet-stream')
            resp = (f'HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\n'
                    f'Content-Length: {len(data)}\r\nConnection: close\r\n\r\n').encode() + data
        else:
            msg  = f'404 Not Found: {path}'.encode()
            resp = (f'HTTP/1.1 404 Not Found\r\nContent-Length: {len(msg)}\r\n\r\n').encode() + msg
        writer.write(resp)

    await writer.drain()
    writer.close()

# ═══════════════════════════════════════════════════════════════
# WEBSOCKET HANDLER
# ═══════════════════════════════════════════════════════════════
async def handle_ws(reader, writer, headers):
    key = headers.get('sec-websocket-key', '')
    if not key: writer.close(); return

    writer.write((
        'HTTP/1.1 101 Switching Protocols\r\n'
        'Upgrade: websocket\r\nConnection: Upgrade\r\n'
        f'Sec-WebSocket-Accept: {ws_accept(key)}\r\n\r\n'
    ).encode())
    await writer.drain()

    pid = room_code = None
    entry = None

    def rs():
        """Get or create room state."""
        if room_code not in room_state:
            room_state[room_code] = {'lobby': {}, 'match_id': None, 'round': 1, 'mode': 2}
        return room_state[room_code]

    try:
        while True:
            op, data = await recv_frame(reader)
            if op is None or op == 8: break
            if op == 9: writer.write(bytes([0x8a, 0])); await writer.drain(); continue
            if op not in (1, 2): continue
            try: msg = json.loads(data)
            except: continue

            pid = msg.get('_from', pid)
            mtype = msg.get('type')

            # ── Room join ──
            if mtype == 'JOIN_ROOM':
                room_code = msg.get('room_code', '').upper()
                if room_code not in rooms: rooms[room_code] = []
                entry = (reader, writer, pid)
                rooms[room_code].append(entry)
                print(f'[ROOM {room_code}] {pid} joined ({len(rooms[room_code])} players)')
                await broadcast(room_code, msg, exclude=writer)

            # ── Track lobby state for DB ──
            elif mtype == 'LUPDATE' and room_code:
                state = rs()
                state['lobby'][msg.get('_from', pid)] = msg.get('data', {})
                await broadcast(room_code, msg, exclude=writer)

            elif mtype == 'ANNOUNCE' and room_code:
                state = rs()
                state['lobby'][msg.get('_from', pid)] = {'name': msg.get('name',''), 'team':'', 'charIdx':-1, **(msg.get('data') or {})}
                await broadcast(room_code, msg, exclude=writer)

            elif mtype == 'SET_MODE' and room_code:
                rs()['mode'] = msg.get('mode', 2)
                await broadcast(room_code, msg, exclude=writer)

            # ── DB: match ended ──
            elif mtype == 'REND' and room_code:
                winner = msg.get('winner')
                sc     = msg.get('score', [0, 0])
                rn     = msg.get('rn', 1)
                state  = rs()
                lobby_s = state.get('lobby', {})
                mode    = state.get('mode', 2)

                match_over = sc[0] >= 3 or sc[1] >= 3 or rn >= 7
                if match_over:
                    team_a = [p.get('name','?') for p in lobby_s.values() if p.get('team') == 'A']
                    team_b = [p.get('name','?') for p in lobby_s.values() if p.get('team') == 'B']
                    if team_a or team_b:  # only save if we have player data
                        match_winner = 'A' if sc[0] > sc[1] else 'B' if sc[1] > sc[0] else 'DRAW'
                        mode_str = '1v1' if mode == 1 else '2v2'
                        mid = save_match(match_winner, team_a, team_b, sc[0], sc[1], rn, mode_str)
                        state['match_id'] = mid
                    state['round'] = 1
                else:
                    state['round'] = rn + 1
                await broadcast(room_code, msg, exclude=writer)

            # ── DB: kill event ──
            elif mtype == 'KF' and room_code:
                state    = rs()
                match_id = state.get('match_id')
                round_n  = state.get('round', 1)
                killer   = msg.get('killer', '').upper()
                victim   = msg.get('victim', '').upper()
                kchar    = msg.get('killer_char', '')
                vchar    = msg.get('victim_char', '')
                if killer and victim:
                    save_kill(match_id, round_n, killer, victim, kchar, vchar)
                await broadcast(room_code, msg, exclude=writer)

            elif room_code and room_code in rooms:
                await broadcast(room_code, msg, exclude=writer)

    except Exception as e:
        print(f'[ERR] {pid}: {e}')
    finally:
        print(f'[-] {pid} left')
        if room_code and room_code in rooms and entry:
            try: rooms[room_code].remove(entry)
            except ValueError: pass
            if not rooms[room_code]:
                del rooms[room_code]
                room_state.pop(room_code, None)
                print(f'[ROOM {room_code}] empty, removed')
        try: writer.close()
        except: pass

async def broadcast(room_code, msg, exclude=None):
    dead, data = [], json.dumps(msg)
    for entry in list(rooms.get(room_code, [])):
        r, w, p = entry
        if w is exclude: continue
        try: await ws_send(w, data)
        except: dead.append(entry)
    for e in dead:
        try: rooms[room_code].remove(e)
        except: pass

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
async def main():
    init_db()
    print('=' * 58)
    print('  NEON DUEL 2v2 — SERVER + DATABASE (port 8080)')
    print('=' * 58)
    print(f'  Database : {DB_PATH}')
    print()
    print('  API Endpoints:')
    print('    /api/leaderboard       top players by wins')
    print('    /api/matches           recent match history')
    print('    /api/kills             recent kill feed')
    print('    /api/player/NAME       player profile & stats')
    print()
    print('  STEP 1: ngrok http 8080')
    print('  STEP 2: Share https://XXXX.ngrok-free.app/index.html')
    print('=' * 58)

    srv = await asyncio.start_server(handle, '0.0.0.0', 8080)
    print('[OK] Server running on port 8080. Ctrl+C to stop.\n')
    async with srv:
        await srv.serve_forever()

if __name__ == '__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: print('\n[STOP] Bye!')
