const cheerio = require('cheerio');
const request = require('request-promise');
const fs = require('fs');
const moment = require('moment');
const Axios = require("axios");
const zlib = require('zlib');
const unzip = zlib.createUnzip();
const ProgressBar = require('progress')
const Path = require('path')
const crypto = require('crypto');


require('events').EventEmitter.defaultMaxListeners = 25;

const fetchPage = async (url, n) => {
    try {
        const result = await Axios.get(url);
        //console.log(result.data)
        return result.data;
    } catch (err) {
        if (n === 0) throw err;

        console.log("fetchPage(): Waiting For 3 seconds before retrying the request.")
        await waitFor(3000);
        console.log(`Request Retry Attempt Number: ${7 - n} ====> URL: ${url}`)
        return await fetchPage(url, n - 1);
    }
};

const CDTData = async () => {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    try {

        const websiteTableContent = $('#pagetoc ol a');
        const catalogues = websiteTableContent.map(async (i, a) => {
            return $(a).attr('href');
            //CDTCatalogue.push($(a).attr('href'))
        }).get();

        return Promise.all(catalogues);
    } catch (error) {
        throw error;
    }
}

const exportResults = (results, outputFile) => {

    try {
        fs.writeFile(outputFile, JSON.stringify(results, null, 4), (err) => {
            if (err) {
                console.log(err);
            }
            console.log('\n' + results.length + ' Results exported successfully to ' + outputFile);
        })
    } catch (error) {
        throw error;
    }

}

const CDTDataLinks = async (data) => {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    var CDTCatalogueLinks = [];
    data.forEach(element => {
        //console.log(element + " table tbody a")
        //let CDTElement = $(element + " table tbody a");
        const CDTElement = $(element);
        CDTElement.each((i, e) => {
            const CDTLink = $(e).find('table.filelisting tbody tr td a');
            const CDTDate = $(e).find('table.filelisting tbody tr td');
            //console.log(i, CDTLink.attr('href'), CDTDate.next().html(), CDTDate.next().next().html());
            let link = CDTLink.attr('href');
            if (link.substring(link.length - 6, link.length) == "csv.gz" || link.substring(link.length - 3, link.length) == "csv") {
                CDTCatalogueLinks.push("http://ctdbase.org" + CDTLink.attr('href') + "|" + CDTDate.next().html() + "|" + CDTDate.next().next().html());
            }
        });

    })
    return CDTCatalogueLinks;
}

async function downloadFile(urlFile, folderName, fileName) {
    //const url = 'https://unsplash.com/photos/AaEQmoufHLk/download?force=true'
    const { data, headers } = await Axios({
        url: urlFile,
        method: 'GET',
        responseType: 'stream'
      });
      const totalFileLength = headers['content-length'];
    const name = await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(
            Path.resolve(__dirname, folderName, fileName)
        );
        let totalLength = 0;
        
        data
            .on("data", chunk => {
                //console.log('filename: ' + fileName + ', chunk size: ' + chunk.length + ', Loaded: ' + totalLength + ' out of ' + totalFileLength);
                writer.write(chunk, "binary");
                totalLength += chunk.length;
            })
            .on("error", reject)
            .on("end", () => {
                //console.log('File: ' + fileName + ' has been created!!!');
                console.log('Done!!!');
                writer.end();
                resolve(fileName);
            });
        });
        //await fs.writeFile(Path.resolve(__dirname, folderName, fileName));
        return name;
    
    
    //data.pipe(writer)
}

const CDTExportFiles = async (resultJSON) => {
    resultJSON.forEach(async urlElement => {

        url = urlElement['URL'];
        fileName = url.substring(27, url.length);
        console.log(url);
        //dir = "HistoryFiles/" + urlElement['Date']
        //date = moment(urlElement['Date']).format('MM-DD-YYYY');
        date = moment(urlElement['Date'], "MM-DD-YYYY");
        date = moment(date).format('YYYYMMDD');
        //console.log(date);
        if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
            dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7);
        } else {
            dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
        }

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            //request(urlElement['URL']).pipe(fs.createWriteStream(dir + "/" + fileName));
        }

        if (!fs.existsSync(dir + "/" + date)) {
            fs.mkdirSync(dir + "/" + date);
            //request(urlElement['URL']).pipe(fs.createWriteStream(dir + "/" + date + "/" + fileName));
            //const req = request({
            //    uri: url
            //});//.pipe(fs.createWriteStream(dir + "/" + date + "/" + fileName));*/
            //const response = await streamToFile(req, dir + "/" + date + "/" + fileName);
            //console.log(response);
            //if(fileName != 'CTD_genes_diseases.csv.gz'){
            if(fileName != 'CTD_genes_diseases.csv.gz'){
                fileCreated = await downloadFile(url, dir + "/" + date, fileName)
                console.log('File: ' + fileCreated + ' has been created!!!');
            }     
        }
    })
}

const CDTDecompressFiles = async (resultJSON) => {
    resultJSON.forEach(async urlElement => {

        url = urlElement['URL'];
        fileName = url.substring(27, url.length);
        console.log(url);
        //dir = "HistoryFiles/" + urlElement['Date']
        //date = moment(urlElement['Date']).format('MM-DD-YYYY');
        date = moment(urlElement['Date'], "MM-DD-YYYY");
        date = moment(date).format('YYYYMMDD');
        //console.log(date);
        if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
            dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7);
        } else {
            dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
        }

        if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz" && fileName != "CTD_genes_diseases.csv.gz") {
            const inp = fs.createReadStream(dir + "/" + date + "/" + fileName);
            const out = fs.createWriteStream(dir + "/" + date + "/" + fileName.substring(0, fileName.length - 3));
            const unzip = zlib.createGunzip();
            inp.pipe(unzip).pipe(out);
            
            //const fileContents = fs.createReadStream('./data/file1.txt.gz');
            //const writeStream = fs.createWriteStream('./data/file1.txt');
            //const unzip = zlib.createGunzip();
            
            //fileContents.pipe(unzip).pipe(writeStream);
            //console.log(dir + "/" + date + "/" + fileName);
            //console.log(dir + "/" + date + "/" + fileName.substring(0, fileName.length-3));
        }

        
    })
}

const streamToFile = async (inputStream, filePath) => {
    return new Promise((resolve, reject) => {
        const fileWriteStream = fs.createWriteStream(filePath);
        inputStream
            .pipe(fileWriteStream)
            .on('finish', resolve)
            .on('error', reject)
    })
}
/*CDTData()
  .then(results => {
   console.log("number of results: "+results.length);
   exportResults(results, "CDTData.json");
    console.log(results);
  }).catch(err => {
   console.log("Error while retrieving Catalogues :::: "+err);
  })*/
async function init() {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    const data = await CDTData();
    console.log("number of results: " + data.length);
    CDTCatalogueLinks = await CDTDataLinks(data);
    console.log(CDTCatalogueLinks);
    resultJSON = [];
    CDTCatalogueLinks.forEach(element => {
        //console.log(element);
        var jsonObj = {};
        var string = element.split("|");
        //console.log(string[0]);
        jsonObj['URL'] = string[0];
        jsonObj['Date'] = string[1];
        jsonObj['Size'] = string[2];
        //console.log(jsonObj);
        resultJSON.push(jsonObj);
        //console.log(result);
        //CDTAllFilesInformation.push(string);
    });
    //await CDTExportFiles(resultJSON);
    await CDTDecompressFiles(resultJSON);

    //console.log("Job Completed");
}

init();


/*async function init() {
const $ = await request({
uri: 'http://ctdbase.org/downloads',
transform: body => cheerio.load(body)
});

var CDTCatalogue = [];
var CDTCatalogueLinks = [];
var CDTAllFilesInformation = [];

const websiteTableContent = $('#pagetoc ol a');
const catalogues = websiteTableContent.map(async (i, a) => {
return $(a).attr('href');
//CDTCatalogue.push($(a).attr('href'))
});

await Promise.all(catalogues)

return CDTCatalogue;

CDTCatalogue.forEach(element => {
//console.log(element + " table tbody a")
//let CDTElement = $(element + " table tbody a");
const CDTElement = $(element);
CDTElement.each((i, e) => {
const CDTLink = $(e).find('table.filelisting tbody tr td a');
const CDTDate = $(e).find('table.filelisting tbody tr td');
//console.log(i, CDTLink.attr('href'), CDTDate.next().html(), CDTDate.next().next().html());
let link = CDTLink.attr('href');
if (link.substring(link.length - 6, link.length) == "csv.gz" || link.substring(link.length - 3, link.length) == "csv") {
CDTCatalogueLinks.push("http://ctdbase.org" + CDTLink.attr('href') + "|" + CDTDate.next().html() + "|" + CDTDate.next().next().html());
}
});
/*let link = "http://ctdbase.org" + CDTElement.attr('href');
let CDTElementDate = $(element + " table tbody tr td");

if(link.substring(link.length-6, link.length) == "csv.gz" || link.substring(link.length-3, link.length) == "csv"){
CDTCatalogueLinks.push("http://ctdbase.org" + CDTElement.attr('href') + "|" + CDTElementDate.next().html());
//console.log(CDTElementDate.next().html());
}
//console.log(element);
})
//console.log(CDTCatalogueLinks);
var result = []
//console.log(CDTCatalogueLinks);
let numCallbackRuns = 0
CDTCatalogueLinks.forEach(element => {
//console.log(element);
var jsonObj = {};
var string = element.split("|");
//console.log(string[0]);
jsonObj['URL'] = string[0];
jsonObj['Date'] = string[1];
jsonObj['Size'] = string[2];
//console.log(jsonObj);
result.push(jsonObj);
//console.log(result);
//CDTAllFilesInformation.push(string);
});
//console.log(result);
result.forEach(async urlElement => {
//console.log(urlElement['URL']);
url = urlElement['URL'];
fileName = url.substring(27, url.length);

//dir = "HistoryFiles/" + urlElement['Date']
//date = moment(urlElement['Date']).format('MM-DD-YYYY');
date = moment(urlElement['Date'], "MM-DD-YYYY");
date = moment(date).format('YYYYMMDD');
//console.log(date);
if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7);
} else {
dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
}

if (!fs.existsSync(dir)) {
fs.mkdirSync(dir);
//request(urlElement['URL']).pipe(fs.createWriteStream(dir + "/" + fileName));
}

if (!fs.existsSync(dir + "/" + date)) {
fs.mkdirSync(dir + "/" + date);
//request(urlElement['URL']).pipe(fs.createWriteStream(dir + "/" + date + "/" + fileName));
const req = request({
uri: urlElement['URL'],
headers: {
    'Connection': 'keep-alive',
    'Accept-Encoding': '',
    'Accept-Language': 'en-US,en;q=0.8'
}
}).pipe(fs.createWriteStream(dir + "/" + date + "/" + fileName));
}
})
return result;
}

function unzipFiles(result) {
result.forEach(async urlElement => {
url = urlElement['URL'];
fileName = url.substring(27, url.length);

//dir = "HistoryFiles/" + urlElement['Date']
//date = moment(urlElement['Date']).format('MM-DD-YYYY');
date = moment(urlElement['Date'], "MM-DD-YYYY");
date = moment(date).format('YYYYMMDD');
//console.log(date);
if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7);
} else {
dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
}

if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
const inp = fs.createReadStream(dir + "/" + date + "/" + fileName);
const out = fs.createWriteStream(dir + "/" + date + "/" + fileName.substring(0, fileName.length - 3));
const unzip = zlib.createGunzip();
inp.pipe(unzip).pipe(out);

//const fileContents = fs.createReadStream('./data/file1.txt.gz');
//const writeStream = fs.createWriteStream('./data/file1.txt');
//const unzip = zlib.createGunzip();

//fileContents.pipe(unzip).pipe(writeStream);
//console.log(dir + "/" + date + "/" + fileName);
//console.log(dir + "/" + date + "/" + fileName.substring(0, fileName.length-3));
}
})
}*/
//console.log(init());
//unzipFiles(init());
