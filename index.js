var assert = require('assert');
var archiver = require('archiver');
var async = require('async');
var AWS = require('aws-sdk');
var fs = require('fs');
var extend = require('node.extend');

function s3Archiver(awsConfig, localConfig) {
  localConfig = localConfig == null ? {} : localConfig;

  assert.ok(awsConfig, 'AWS S3 options must be defined.');
  assert.notEqual(awsConfig.accessKeyId, undefined, 'Requires S3 AWS Key.');
  assert.notEqual(awsConfig.secretAccessKey, undefined, 'Requires S3 AWS Secret');
  assert.notEqual(awsConfig.region, undefined, 'Requires AWS S3 region.');
  assert.notEqual(awsConfig.bucket, undefined, 'Requires AWS S3 bucket.');
  this.initialise(awsConfig, localConfig);
}

//Initialises all of the S3 config
s3Archiver.prototype.initialise = function(awsConfig, localConfig) {
  //Set up global settings
  this.awsConfig = awsConfig;

  //Instantiate AWS with configuration
  AWS.config.update({
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
    region: awsConfig.region
  });
  this.bucketParams = {
    Bucket: this.awsConfig.bucket,
    Delimiter: "/",
    Prefix: localConfig.folder + "/"
  };
  this.bucket = new AWS.S3({
    params: this.bucketParams
  });

  this.localConfig = localConfig;
};

//Creates a file name based on the S3 file path
s3Archiver.prototype.generateFileName = function(fileName) {
  var name = fileName.split("/");
  name.shift();
  name = name.join("/");
  return name;
};

//The main entry point for the zipping and uploading
s3Archiver.prototype.zipFiles = function(fileNames, labels, outputFile, uploadOptions, callback) {
  var s3Archiver = this;

  //Create the output stream for the temporary zip file
  var fileName = "/tmp" + process.hrtime()[1] + ".zip";
  var output = fs.createWriteStream(fileName);

  var archive = archiver('zip');

  //Called when the zip file is finalized
  output.on('close', function() {
    console.log(archive.pointer(), "total bytes");
    s3Archiver.uploadZipFile(fileName, outputFile, uploadOptions, function(err, data) {
      if(err) {
        return callback(err);
      }

      //Delete the temporary file
      fs.unlink(fileName, function(err) {
		callback(null, data);
	  });
    });
  });

  archive.on('error', function(err) {
    callback(err);
  });

  archive.pipe(output);

  this.getFileList(function(list) {
    async.map(list, function(file, c) {
      //Only download the files in the given filter
      if(fileNames.indexOf(file) === -1) {
        return c(null);
      }

      s3Archiver.bucket.getObject({Bucket: s3Archiver.awsConfig.bucket, Key: file}, function(err, data) {
        if(err) {
          return c(err);
        }

        //Add the file to the zip
        // var fileName = s3Archiver.generateFileName(file);
        var index = fileNames.indexOf(file);
        var label = labels[index];
        //Ensure the file name is valid
        if(fileName !== "") {
          archive.append(data.Body, {name: label, prefix: s3Archiver.localConfig.filePrefix});
        }
        return c(null, file);
      });
    }, 
    //Upon appending all files
    function(err, res) {
      //Allow users the ability to edit the zip
      if(s3Archiver.localConfig.finalizing && s3Archiver.localConfig.finalizing instanceof Function)
      {
        return s3Archiver.localConfig.finalizing(archive, function() {
          archive.finalize();
        });
      }

      archive.finalize();
    });
  });
};

//Gets the total list of files from the S3 bucket
s3Archiver.prototype.getFileList = function(callback, fileList, continuationToken) {
  fileList = fileList == null ? [] : fileList;
  continuationToken = continuationToken == null ? "" : continuationToken;

  params = {
  };

  if(continuationToken !== "") {
    params.ContinuationToken = continuationToken;
  }

  var archiver = this;
  this.bucket.listObjectsV2(extend(params, this.bucketParams), function(err, data) {
    for(var i = 0; i < data.Contents.length; i++) {
      fileList.push(data.Contents[i].Key);
    }

    //Recursively call list objects if the output was truncated
    if(data.IsTruncated) {
      return archiver.getFileList(function(list) {

        callback(fileList);
      }, fileList, data.NextContinuationToken);
    }
    callback(fileList);
  });
};

//Uploads the zip file to the S3 bucket
s3Archiver.prototype.uploadZipFile = function(inputFile, outputFile, uploadOptions, callback) {
  uploadOptions = uploadOptions == null ? {} : uploadOptions;

  var readStream = fs.createReadStream(inputFile);

  var uploadParams = {
    Bucket: this.awsConfig.bucket,
    ContentType: "application/zip",
    Body: readStream,
    Key: outputFile
  }

  this.bucket.upload(extend(uploadParams, uploadOptions), function(err, data) {
    if(err) {
      return callback(err);
    }

    callback(null, data);
  });
};

module.exports = s3Archiver;
