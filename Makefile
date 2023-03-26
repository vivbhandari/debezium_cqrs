IMAGE=vivekbhandari/debezium-consumer
TABLENAME=customers

image:
	docker build -t ${IMAGE} . -f Dockerfile_consumer

start-consumer-dev:
	docker run -dt --name debezium_debezium_1 --hostname consumer --net debezium_network1 ${IMAGE}

start:
	docker-compose -f docker-compose.yaml up -d

register-connector:
	curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" localhost:8083/connectors/ -d @connector.json

psql:
	docker exec -ti debezium_postgres_1 psql -U postgres

mongo:
	docker exec -ti debezium_mongo_1 mongo -u root -p root

watch-kafka:
	docker run -it --rm --name ${TABLENAME}-watcher --net debezium_network1 -e ZOOKEEPER_CONNECT=debezium_zookeeper_1:2181 -e KAFKA_BROKER=debezium_kafka_1:9092 debezium/kafka:1.2 watch-topic -a -k fullfillment.inventory.${TABLENAME}

logs:
	docker ps -a
	docker logs -f debezium_consumer_1

removeDanglingImages:
	docker rmi -f `docker images -f "dangling=true" -q`

all:
	make stop
	make image
	make start
	make logs

stop:
	docker stop `docker ps --no-trunc -aq`
	docker rm `docker ps --no-trunc -aq`