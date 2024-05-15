import * as net from "net";
import {argv} from "node:process";
import {gzip} from "zlib";
import {readFile, writeFile} from "node:fs";

const server = net.createServer((socket) => {
    socket.on("data", (data) => {
        const [requestLine, ...headers] = data.toString().split("\r\n");
        const [body] = headers.splice(headers.length - 1);
        const requestHeaders: Record<string, string> = {};
        headers.forEach((header) => {
            const [key, value] = header.split(": ");
            requestHeaders[key] = value;
        });
        const [method, path] = requestLine.split(" ");
        switch (method) {
            case "GET": {
                if (path === "/") {
                    socket.write("HTTP/1.1 200 OK\r\n\r\n");
                    socket.end();
                } else if (path === "/user-agent") {
                    const userAgent = requestHeaders?.["User-Agent"];
                    const headers = {
                        "Content-Type": "text/plain",
                        "Content-length": Buffer.byteLength(userAgent),
                    };
                    socket.write(
                        `HTTP/1.1 200 OK\r\n${Object.keys(headers)
                            .map((key) => `${key}: ${headers[key]}`)
                            .join("\r\n")}\r\n\r\n${userAgent}`
                    );
                    socket.end();
                } else if (path.startsWith("/echo/")) {
                    let resBody = path.slice("/echo/".length);
                    const headers = {
                        "Content-Type": "text/plain",
                        "Content-length": Buffer.byteLength(resBody),
                    };
                    if (
                        requestHeaders?.["Accept-Encoding"]?.split(", ")?.includes("gzip")
                    ) {
                        headers["Content-Encoding"] = "gzip";
                        gzip(resBody, (err, compressedData) => {
                            if (err) {
                                console.error("Failed to gzip the response body:", err);
                                socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
                                socket.end();
                                return;
                            }
                            headers["Content-length"] = Buffer.byteLength(compressedData);
                            socket.write(
                                `HTTP/1.1 200 OK\r\n${Object.keys(headers)
                                    .map((key) => `${key}: ${headers[key]}`)
                                    .join("\r\n")}\r\n\r\n`
                            );
                            socket.write(compressedData);
                            socket.end();
                        });
                    } else {
                        socket.write(
                            `HTTP/1.1 200 OK\r\n${Object.keys(headers)
                                .map((key) => `${key}: ${headers[key]}`)
                                .join("\r\n")}\r\n\r\n${resBody}`
                        );
                        socket.end();
                    }
                } else if (path.startsWith("/files/")) {
                    const dir = argv[argv.length - 1];
                    const filename = dir + "/" + path.slice("/files/".length);
                    readFile(filename, (err, data) => {
                        if (err) {
                            socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                            socket.end();
                        } else {
                            const headers = {
                                "Content-Type": "application/octet-stream",
                                "Content-length": Buffer.byteLength(data),
                            };
                            socket.write(
                                `HTTP/1.1 200 OK\r\n${Object.keys(headers)
                                    .map((key) => `${key}: ${headers[key]}`)
                                    .join("\r\n")}\r\n\r\n${data}`
                            );
                        }
                        socket.end();
                    });
                } else {
                    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                    socket.end();
                }
                break;
            }
            case "POST": {
                if (path.startsWith("/files/")) {
                    const dir = argv[argv.length - 1];
                    const filename = dir + "/" + path.slice("/files/".length);
                    writeFile(filename, body, (err) => {
                        if (err) {
                            socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                            socket.end();
                        } else {
                            socket.write("HTTP/1.1 201 Created\r\n\r\n");
                            socket.end();
                        }
                    });
                } else {
                    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                    socket.end();
                }
                break;
            }
            default: {
                socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                socket.end();
                break;
            }
        }
    });
});
// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
// Uncomment this to pass the first stage
server.listen(4221, "localhost", () => {
    console.log("Server is running on port 4221");
});