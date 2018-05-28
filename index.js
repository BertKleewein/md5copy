/*jshint esversion: 6 */
/*jshint strict:false */
/*jshint node:true */
'use strict';

var async = require('async');
var file = require('file');
var fs = require('fs');
var os = require('os');
var path = require('path');
var md5File = require('md5-file');
var args = require('yargs')
    .usage('$0 --startdir [startdir] --log [logfile]')
    .require('startdir', 'root to generate md5 for')
    .require('log', 'file to store hashes in')
    .help(false)
    .version(false)
    .argv;

/**
 * list of files to be hashes
 */
var workList = [];

/**
 * hash->filename lookup
 */
var hashList = {};

/**
 * filename->hash lookup for skipping files that have already been hashed.
 */
var completedFiles = {};

/**
 * Count of files to report
 */
var reportingInterval = 100;

/**
 * Numbrer of files processed
 */
var completedFileCount = 0;

var numCores = os.cpus().length;
numCores = 2;
console.log(`running on ${numCores} cores`);

/**
 * start walking the directory and adding files to the work list.
 */
var startWalking = () => {
    file.walk(args.startdir, (err, dirpath, dirs, files) => {
        if (!err && files) {
            files.forEach((filename) => {
                workList.push(filename);
            });
        }
    });
};

/**
 * increment file count and output count
 */
var addCounter = () => {
    completedFileCount++;
    if ((completedFileCount % reportingInterval) === 0) {
        console.log(`${completedFileCount} files completed`);
    }
};

var addFile = function(hash, filename) {
    completedFiles[filename] = hash;
    if (hashList[hash]) {
        var found = false;
        hashList[hash].forEach((foundFile) => {
            if (filename === foundFile) {
                found = true;
            }
        });
        if (!found) {
            hashList[hash].push(filename);
        }
    } else {
        hashList[hash] = [ filename ];
    }
};


var didWorkLastLoop = true;
/**
 * hash next batch of files from the worklist.
 */
var hashNextBash = () => {
    var thisWorkList = workList;
    workList = [];
    if (thisWorkList.length === 0) {
        if (didWorkLastLoop) {
            console.log('work list empty.  Sleeping for 1 second');
            setTimeout(hashNextBash, 1000);
            didWorkLastLoop = false;
        } else {
            console.log('done working.  exiting');
            writeLog();
            process.exit(0);
        }
    } else {
        didWorkLastLoop = true;
        console.log(`processing ${thisWorkList.length} files`);
        async.eachLimit(thisWorkList, numCores, (filename, callback) => {
            if (completedFiles[filename]) {
                addCounter();
                process.nextTick(callback);
            } else {
                md5File(filename, (err, hash) => {
                    if (err) {
                        console.log('error hashing ' + filename + ': ' + err);
                        addCounter();
                        callback();
                    } else {
                        addFile(hash, filename);
                        addCounter();
                        callback();
                    }
                });
            }
        },(err) => {
            console.log(`done with ${thisWorkList.length} files.`);
            if (err) {
                console.log('error encountered: ' + err);
            }
            process.nextTick(hashNextBash);
        });
    }
};

/**
 * save the log for future reading
 */
var writeLog = () => {
    console.log('saving...');
    fs.writeFileSync(args.log, JSON.stringify(hashList, null, '  '));
};

/**
 * read the log from a previous run
 */
var readLog = () => {
    try {
        fs.statSync(args.log);
        hashList = JSON.parse(fs.readFileSync(args.log).toString());
    } catch(e) {

    }
    console.log(`read ${Object.keys(hashList).length} unique files`);
    Object.keys(hashList).forEach((key) => {
        hashList[key].forEach((filename) => {
            completedFiles[filename] = key;
        });
    });
};

readLog();
setInterval(writeLog, 120000);
startWalking();
setTimeout(hashNextBash,1000);