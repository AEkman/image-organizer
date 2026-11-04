.PHONY: run test build
run:
	go tool air -c .air.toml

test:
	go test ./...
	node --test web_test.cjs

build:
	go build -o bin/image-organizer .
