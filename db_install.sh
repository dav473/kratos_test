#!/bin/bash

INIT_MARKER_FILE="/var/lib/docker/init_done"

# Check if the marker file exists
if [ ! -e "$INIT_MARKER_FILE" ]; then
    # Run initialization steps
    echo "Running initialization steps..."

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
    su -c "psql -c \"CREATE USER kratos PASSWORD '$KRATOS_POSTGRES_PASSWORD';\"" postgres
    su -c "psql -c \"CREATE USER hydra PASSWORD '$HYDRA_POSTGRES_PASSWORD';\"" postgres
    su -c "psql -c \"GRANT CONNECT ON DATABASE kratos to kratos;\"" postgres
    su -c "psql -c \"GRANT CONNECT ON DATABASE hydra to hydra;\"" postgres
      
    # Create the marker file to indicate that initialization is done
    touch "$INIT_MARKER_FILE"

    echo "Initialization complete."
else
    echo "Initialization already done. Skipping."
fi
