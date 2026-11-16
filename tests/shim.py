# Stand-in for Supabase's REST layer, for local testing only: POST /rest/v1/rpc/<fn> -> select public.<fn>(...)
import json, sys, psycopg2
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT = sys.argv[1]
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_OPTIONS(self):
        self.send_response(204); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.end_headers()
    def do_POST(self):
        fn = self.path.rsplit('/', 1)[-1]
        args = json.loads(self.rfile.read(int(self.headers['Content-Length'])) or b'{}')
        assert fn.startswith('yz_') and fn.replace('_', '').isalnum()
        parts, vals = [], []
        for k, v in args.items():
            t = 'uuid' if k in ('p_token', 'p_owner') else 'jsonb' if (k == 'p_data' and fn == 'yz_put') else 'text'
            parts.append(f"{k} => %s::{t}"); vals.append(json.dumps(v) if t == 'jsonb' else v)
        con = psycopg2.connect(host='/tmp', port=5544, user='pg', dbname='postgres'); con.autocommit = True
        cur = con.cursor(); cur.execute('set role anon')
        try: cur.execute(f"select public.{fn}({', '.join(parts)})", vals); body = json.dumps(cur.fetchone()[0]); code = 200
        except Exception as e: body = json.dumps({'message': str(e)}); code = 400
        con.close()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers(); self.wfile.write(body.encode())
ThreadingHTTPServer(('127.0.0.1', 8787), H).serve_forever()
