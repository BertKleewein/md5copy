/*jshint esversion: 6 */
/*jshint strict:false */
/*jshint node:true */
'use strict';

var fs = require('fs');
var args = require('yargs')
    .usage('$0 --keepjson [keepjson] --erasejson [erasejson]')
    .require('keepjson', 'json file with files to keep')
    .require('erasejson', 'json file with files to potentially erase')
    .help(false)
    .version(false)
    .argv;

var keep = JSON.parse(fs.readFileSync(args.keepjson).toString());
var erase = JSON.parse(fs.readFileSync(args.erasejson).toString());

Object.keys(keep).forEach(hash => {
    if (erase[hash]) {
        erase[hash].forEach(filename => {
            console.log(`del "$filename`);
        });
        delete erase[hash];
    }
});

fs.writeFileSync(args.eraseJson + '.new', JSON.stringify(erase, null, '  '));
