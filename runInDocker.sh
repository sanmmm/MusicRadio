pm2 install pm2-logrotate
pm2 set pm2-logrotate:retain 10
pm2 set pm2-logrotate:compress false 
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss 
pm2 set pm2-logrotate:max_size 5M 
pm2 set pm2-logrotate:rotateInterval '0 0 * * * '
pm2 set pm2-logrotate:rotateModule true 
pm2 set pm2-logrotate:workerInterval 30 
pm2 start backend/build/backend/app.js --no-daemon --log-date-format 'YYYY-MM-DD_HH:mm:ss'