clean:
	mongo doxdox --eval "db.dropDatabase()"
	rm -rf temp/
