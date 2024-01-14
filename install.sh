#!/bin/bash

if ! id "kratos" &> /dev/null; then
#PostgreSQL
        export DEBIAN_FRONTEND=noninteractive
        # Install
        apt install postgresql postgresql-contrib -y
		
	#Start postgresql
	service postgresql start
	
	#Create DB as Postgres user
	su -c "createdb kratos" postgres
	
	#Create user and add access
	su -c "psql -c \"CREATE USER kratos PASSWORD '$POSTGRES_PASSWORD';\"" postgres
	su -c "psql -c \"GRANT CONNECT ON DATABASE kratos to kratos;\"" postgres
		

# Kratos
        # Create user
        useradd -s /bin/false -m -d /opt/kratos kratos

        # Create directories
        mkdir -p /opt/kratos/{bin,config}

        # Change to bin directory
        cd /opt/kratos/bin

        # Download Kratos release
        wget https://github.com/ory/kratos/releases/download/v1.0.0/kratos_1.0.0-linux_64bit.tar.gz

        # Extract Kratos archive
        tar xfvz kratos_1.0.0-linux_64bit.tar.gz

        # Download config files
        cd ../config
	wget -N https://raw.githubusercontent.com/dav473/kratos_test/main/identity.schema.json
	wget -N https://raw.githubusercontent.com/dav473/kratos_test/main/kratos.yml
	
	#Modify kratos.yml
	awk -v new_dsn="postgres://kratos:$POSTGRES_PASSWORD@127.0.0.1:5432/kratos?sslmode=disable&max_conns=20&max_idle_conns=4" '/dsn:/ {$2=new_dsn} 1' "kratos.yml" | sed '/^\s*$/d' > temp.yml && mv temp.yml "kratos.yml"
	
	#DB migration
	/opt/kratos/bin/kratos -c /opt/kratos/config/kratos.yml migrate sql -y postgres://kratos:$POSTGRES_PASSWORD@127.0.0.1:5432/kratos?sslmode=disable
	
	#Start Kratos
	/opt/kratos/bin/kratos -c /opt/kratos/config/kratos.yml serve
		
	echo "------SUCCESSFULLY INSTALLED------"
else    
	#Start PostgreSQL
	service postgresql start
	#Start Kratos
	/opt/kratos/bin/kratos -c /opt/kratos/config/kratos.yml serve
	echo "------ALREADY INSTALLED------"
fi
