import queue

class MessageAnnouncer:
    def __init__(self):
        self.listeners = []

    def listen(self):
        q = queue.Queue(maxsize=5)
        self.listeners.append(q)
        return q

    def announce(self, msg):
        # 廣播訊息給所有連線者 (格式必須符合 SSE 規範: data: ...\n\n)
        for i in reversed(range(len(self.listeners))):
            try:
                self.listeners[i].put_nowait(msg)
            except queue.Full:
                del self.listeners[i]

# 全域實例
announcer = MessageAnnouncer()

def format_sse(data: str, event=None) -> str:
    msg = f"data: {data}\n\n"
    if event:
        msg = f"event: {event}\n{msg}"
    return msg