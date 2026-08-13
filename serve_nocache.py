import http.server, socketserver, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 开发期关闭缓存，避免手机/浏览器一直用旧版 index.html
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    print('serving on 0.0.0.0:8124 (no-cache)')
    Server(('0.0.0.0', 8124), Handler).serve_forever()
