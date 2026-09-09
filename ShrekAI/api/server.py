# api/server.py

import json

from http.server import (
    BaseHTTPRequestHandler,
    ThreadingHTTPServer,
)

from core.inference import ShrekInference


ENGINE = ShrekInference()


class Handler(BaseHTTPRequestHandler):

    def _send_json(
        self,
        status,
        data,
    ):

        body = json.dumps(
            data,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )

        self.send_header(
            "Content-Length",
            str(len(body)),
        )

        self.end_headers()

        self.wfile.write(body)

    def do_GET(self):

        if self.path == "/":

            self._send_json(
                200,
                {
                    "name": "ShrekAI",
                    "status": "online",
                },
            )

            return

        if self.path == "/health":

            self._send_json(
                200,
                {
                    "status": "ok",
                },
            )

            return

        self._send_json(
            404,
            {
                "error": "Not found",
            },
        )

    def do_POST(self):

        if self.path != "/chat":

            self._send_json(
                404,
                {
                    "error": "Not found",
                },
            )

            return

        try:

            length = int(
                self.headers.get(
                    "Content-Length",
                    0,
                )
            )

            raw = self.rfile.read(
                length
            )

            payload = json.loads(
                raw.decode("utf-8")
            )

            messages = payload.get(
                "messages",
                [],
            )

            if not isinstance(
                messages,
                list,
            ):
                raise ValueError(
                    "messages must be a list"
                )

            response = ENGINE.generate(
                messages
            )

            self._send_json(
                200,
                {
                    "response": response,
                },
            )

        except Exception as error:

            self._send_json(
                500,
                {
                    "error": str(error),
                },
            )

    def log_message(
        self,
        format,
        *args,
    ):

        return


def start_server(
    host="127.0.0.1",
    port=8765,
):

    server = ThreadingHTTPServer(
        (host, port),
        Handler,
    )

    print(
        f"ShrekAI API running at "
        f"http://{host}:{port}"
    )

    server.serve_forever()


if __name__ == "__main__":
    start_server()