# RelayChess
The future of chess is now!

# Database
MongoDB 3.2.9

# Server
NodeJS 6.5.0

# Dependencies
co, underscore, mongodb

To deploy restore the RelayChess database using `mongorestore`, install node & required dependencies, and launch `app.js`.

Ports used: 9090 for login/register express webserver, 3000 for socket server

# Service (Ubuntu 16.04)
To register RelayChess as a service, copy `relaychess.service` into the system folder then `systemctl daemon-reload`.
