make image

	It creates a new docker image for the consumer app.

make start

	It start all microservices using docker-compose.

make register-connector

	Convenience target to register a new Debezium Kafka connector. It uses connector.json as input.

make watch-logs TABLENAME=< postgres table name >

	Convenience target to start a new Kafka container to watch raw messages for the topic for the specified table.

make psql

	Shortcut to connect to psql prompt.

make mongo

	Shortcut to connect to mongo shell.

make stop

	Convenience target to stop and remove all containers.

Presentation

    https://docs.google.com/presentation/d/1c7pjg2UkVQHlcGlakaXeYWpK-eBul6mw9fBA0nKlKNw/edit?usp=sharing

Setup

    1. make start
    2. make logs
        debezium_consumer_1 may restart automatically as it has dependency on Mongo & Kafka to be up and topics created.
        Once up it should be tailing any messages read by consumer app. You will see "consumer started..." message.
    3. make psql
        SET search_path TO inventory,public;
        \dt
        select * from inventory.customers;
    4. make mongo
        use inventory
        show collections
        db.customer_orders.find({}).pretty()
    5. make watch-logs TABLENAME=customers
    6. make register-connector
    7. All the existing customers and orders data should be present in mongo now
    8. Try some update or delete operations on psql and observe it gets reflected in mongo
