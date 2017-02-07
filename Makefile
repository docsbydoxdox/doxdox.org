clean:
	mongo doxdox --eval "db.dropDatabase()"
	rm -rf temp/

fetch:
	curl -o data/plugins.json "https://api.npms.io/v2/search?from=0&q=doxdox%20plugin&size=25"
