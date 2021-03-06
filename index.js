var Async = require('async');
var fs = require('fs');

require('util').inherits(FileStorage, require('events').EventEmitter);
module.exports = FileStorage;

/**
 * Creates a new FileStorage object
 * @param {string} directory - The local directory where files will be saved if events aren't listened to. No trailing slash. No nesting.
 * @constructor
 */
function FileStorage(directory) {
	Object.defineProperty(this, 'directory', {
		"get": function() {
			return this._directory;
		},
		"set": function(newDir) {
			this._directory = newDir;
			this._directoryCreated = false;
		}
	});

	this._directory = null;
	this._directoryCreated = null;
	this.directory = directory;
}

/**
 * Checks whether or not the FileStorage object can store and retrieve files.
 * @returns bool
 */
FileStorage.prototype.isEnabled = function() {
	return (this.listeners('save').length > 0 && this.listeners('read').length > 0) || this.directory !== null;
};

/**
 * Saves a file
 * @param {string} filename - The name of the file
 * @param {Buffer|string} contents - The contents of the file
 * @param {function} [callback] - Called when the file is saved or an error occurs
 */
FileStorage.prototype.saveFile = FileStorage.prototype.writeFile = function(filename, contents, callback) {
	if(!this.isEnabled()) {
		if(callback) {
			callback(new Error("File storage system is not enabled"));
		}
		
		return;
	}

	if(typeof contents === 'string') {
		contents = new Buffer(contents, 'utf8');
	}

	if(this.listeners('save').length > 0) {
		this.emit('save', filename, contents, function(err) {
			if(callback) {
				callback(err || null);
			}
		});

		return;
	}

	checkDirExists(this.directory);
	this._directoryCreated = true;

	fs.writeFile(this.directory + '/' + filename, contents, callback);
};

/**
 * Saves many files
 * @param {Object} files - Keys are filenames, values are Buffer objects containing the file contents
 * @param {function} [callback] - Called when all files are saved, or an error occurs
 */
FileStorage.prototype.saveFiles = FileStorage.prototype.writeFiles = function(files, callback) {
	var self = this;
	Async.each(Object.keys(files), function(filename, cb) {
		self.saveFile(filename, files[filename], cb);
	}, callback || function() { });
};

/**
 * Reads the contents of a single file
 * @param {string} filename - The name of the file to read
 * @param {function} callback - Called when read, first argument is an Error object or null, second is a Buffer object
 */
FileStorage.prototype.readFile = function(filename, callback) {
	if(!this.isEnabled()) {
		callback(new Error("File storage system is not enabled"));
		return;
	}

	if(this.listeners('read').length > 0) {
		this.emit('read', filename, callback);
		return;
	}

	fs.readFile(this.directory + '/' + filename, callback);
};

/**
 * Reads the contents of multiple files
 * @param {string[]} filenames - An array of filenames
 * @param {function} callback - Called when read. Array with same order as input array, each element is an object with filename and contents properties.
 */
FileStorage.prototype.readFiles = function(filenames, callback) {
	var self = this;
	Async.map(filenames, function(filename, cb) {
		self.readFile(filename, function(err, file) {
			var response = {"filename": filename};

			if(err) {
				response.error = err;
			} else {
				response.contents = file;
			}

			cb(null, response);
		});
	}, callback);
};

function checkDirExists(dir) {
	if(!dir) {
		return;
	}

	var path = '';
	dir.replace(/\\/g, '/').split('/').forEach(function(dir, index) {
		if(index === 0 && !dir) {
			path = '/';
		} else {
			path += (path ? '/' : '') + dir;
		}

		if(!fs.existsSync(path)) {
			fs.mkdirSync(path, 0o750);
		}
	});
}
