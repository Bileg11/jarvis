# Тестийн сервер — кэш хийхгүй.
# (Хөтөч хуучин CSS/JS-ээ санаж, өөрчлөлт харагдахгүй байсан)
import http.server, socketserver, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8734
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), NoCache) as httpd:
    httpd.serve_forever()
