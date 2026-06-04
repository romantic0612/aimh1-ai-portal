FROM nginx:1.25-alpine

COPY deploy/nginx/aimh1-tp51.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html/dist
COPY backend/public /var/www/html/backend/public

EXPOSE 80
