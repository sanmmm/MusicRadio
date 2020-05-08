FROM node:12
WORKDIR /app
RUN npm config set registry https://registry.npm.taobao.org/ && npm install -g pm2
COPY ./frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY ./backend/package*.json ./backend/
RUN cd backend && npm install
COPY ./common/ ./common/
COPY ./frontend/ ./frontend/
ENV OUTPUT_PATH=../static ASYNC_SETTINGS=1 PUBLIC_PATH=/static/
RUN cd ./frontend && npm run build && rm -r /app/frontend
ENV OUTPUT_PATH= ASYNC_SETTINGS= PUBLIC_PATH=
COPY ./backend/ ./backend/
RUN  cd backend && npm run build
ENV STATIC_PATH=/app/static NODE_ENV=production
EXPOSE 3001
CMD ["pm2", "start", "backend/build/backend/app.js", "--no-daemon"]