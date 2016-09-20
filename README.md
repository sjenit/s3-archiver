# S3 Archiver

S3 Archiver is designed to zip and upload a large number of files from a given S3 bucket back to a file on the bucket.
This allows for easier file backups or for serving a large number of files.

## Usage

```npm install s3-archiver```

### Setup
```JavaScript
var s3Archiver = require('s3-archiver');

var archiver = new s3Archiver({
  accessKeyId: "XXX",
  secretAccessKey: "XXX",
  region: "us-west-1",
  bucket: "XXX"
}, {
  folder: "images",
  filePath: __dirname,
  filePrefix: "profile-pics/",
  finalizing: finalizeArchive
});
```

### Parameters
- AWS Config
  - accessKeyId - (String) S3 Access Key
  - secretAccessKey - (String) S3 Secret Access Key
  - region - (String) S3 Region
  - bucket - (String) S3 Bucket Name
- Local Config
  - folder - (String) The folder in the bucket you want the files from (eg. images)
  - filePath - (String) The absolute file path for the temporary file to be saved to
  - filePrefix - (String) The path inside the zip to place the files
  - finalizing - (Function(Object, Function())) Intercepts the finalizing stage of the archive.

### Example
```JavaScript
archiver.zipFiles(["images/1S0QWQLR1Z.jpg", "images/91D6WX13ZG.png"], "downloads/backup-1.zip", {
  ACL: "public-read"
}, function(err, data) {
  console.log(data.Location);
});
```

### Parameters
- File Names - (String Array) The list of file keys that you want to archive
- Output File Name - (String) The file key for the output zip in S3
- Upload Options - (Object) Upload parameters to be applied to the S3 upload ([More info](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property))
- Callback - (Function(Object, Object)) Called when the zip file has been uploaded
  - Error - (Object) If there was an S3 error upon uploading (or null if no error)
  - Data - (Object) The S3 upload data upon successful upload

### Intercepting Archive
```JavaScript
var s3Archiver = require('s3-archiver');

var archiver = new s3Archiver({
  accessKeyId: "XXX",
  secretAccessKey: "XXX",
  region: "us-west-1",
  bucket: "XXX"
}, {
  finalizing: function(archive, finalize) {
    //Add files, change permissions, etc.
    archive.append(anotherFile, {name: 'anotherFile.png'});
    //Must call finalize to complete the archiving
    finalize();
  }
});
```