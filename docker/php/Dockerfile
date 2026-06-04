FROM php:7.4-fpm-bullseye

WORKDIR /var/www/html/backend

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libcurl4-openssl-dev \
        libzip-dev \
        libonig-dev \
    && docker-php-ext-install \
        bcmath \
        curl \
        mbstring \
        mysqli \
        pdo_mysql \
        zip \
    && apt-get clean

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY backend/composer.json ./composer.json
RUN composer create-project topthink/think=5.1.* /tmp/tp51 --prefer-dist --no-dev --no-interaction --no-progress \
    && cp -a /tmp/tp51/thinkphp ./thinkphp \
    && cp -a /tmp/tp51/vendor ./vendor \
    && composer dump-autoload --optimize --no-interaction --no-progress

COPY backend ./

RUN mkdir -p runtime \
    && chown -R www-data:www-data runtime

EXPOSE 9000

CMD ["php-fpm"]
