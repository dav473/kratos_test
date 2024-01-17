#!/bin/bash

if [ !"$INIT" = "1" ]; then
#PostgreSQL
  export DEBIAN_FRONTEND=noninteractive
  # Install
  apt install postgresql postgresql-contrib -y

  #Start postgresql
  service postgresql start
  
  #Create kratos, hydra users
  su -c "createdb kratos" postgres
  su -c "createdb hydra" postgres
  
  #Create user and add access
  su -c "psql -c \"CREATE USER kratos PASSWORD '$POSTGRES_PASSWORD';\"" postgres
  su -c "psql -c \"CREATE USER hydra PASSWORD '$HYDRA_POSTGRES_PASSWORD';\"" postgres
  su -c "psql -c \"GRANT CONNECT ON DATABASE kratos to kratos;\"" postgres
  su -c "psql -c \"GRANT CONNECT ON DATABASE hydra to hydra;\"" postgres
else
  echo "------POSTGRESQL WAS ALREADY INSTALLED------"
fi
