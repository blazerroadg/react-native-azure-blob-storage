import CryptoJS from 'crypto-js'
import { IResolverElement, Resolver } from './resolver'
import Upload, { UploadOptions } from 'react-native-background-upload'
import * as mime from 'react-native-mime-types';


type RequestType =
    | 'Upload'
    | 'Download'
    ;


interface FetchParam {
    assest: any,
    container: string,
    type: RequestType,
    filenameprefix: string
}




interface AzureCosmosBlobElement extends IResolverElement<RequestType> {
    azurBlobFetch(param: FetchParam): Promise<BlobResponse>;
}


class BlobResponse
{
    uploadId : string;
    filename : string;
    constructor(uploadId : string,filename : string)
    {
        this.uploadId = uploadId;
        this.filename = filename;

    }
   
}

interface AzureConfig {
    storageKey: string;
    account: string;
    version: string;

}

class AzureBlobLocator extends Resolver<RequestType, AzureCosmosBlobElement> {
    static myInstance: AzureBlobLocator = null;
    static config: AzureConfig;

    static getInstance() {
        if (AzureBlobLocator.myInstance == null) {
            AzureBlobLocator.myInstance = new AzureBlobLocator();
        }

        return this.myInstance;
    }

    constructor() {
        super();
        super.Add(new AzureBlolUpload())
    }
}




export const initAzureBlob = (config: AzureConfig) => {
    AzureBlobLocator.config = config;
}

const UUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


const IOSAssest = (assest) => {
    if (!assest || !assest.uri) return assest;
    let assestUri = assest.uri;
    if (assestUri.includes("ph:/")) {
        const appleId = assest.uri.substring(5, 41);
        const fil = assest.filename.split('.');
        const ext = fil[1];
        assestUri = `assets-library://asset/asset.${ext}?id=${appleId}&ext=${ext}`;
    }
    return assestUri;
}



class AzureBlolUpload implements AzureCosmosBlobElement {
    Key: RequestType = 'Upload';
    constructor() {
    }
    async azurBlobFetch(param: FetchParam) {
        const today = new Date();
        const UTCstring = today.toUTCString();
        let authparam = new AuthParam();
        authparam.request = "PUT";
        authparam.version = AzureBlobLocator.config.version;
        authparam.storagekey = AzureBlobLocator.config.storageKey;
        authparam.account = AzureBlobLocator.config.account;
        authparam.container = param.container;
        authparam.blobtype = "BlockBlob";
        authparam.filename = `${param.filenameprefix}${UUID()}`;
        authparam.date = UTCstring;
        const metadata = await Upload.getFileInfo(param.assest.uri);
        authparam.length = metadata.size || param.assest.fileSize;
        authparam.contentType = metadata.mimeType || mime.lookup(param.assest.filename).toString();
        const uri = IOSAssest(param.assest);
        const auth = authHead(authparam);
        const options: UploadOptions = {
            url: `https://${authparam.account}.blob.core.windows.net/${authparam.container}/${authparam.filename}`,
            path: uri,
            method: 'PUT',
            type: 'raw',
            headers: {
                'content-type': `${authparam.contentType}`,
                'Content-Length': `${authparam.length}`,
                'x-ms-version': `${authparam.version}`,
                'x-ms-blob-type': 'BlockBlob',
                'Authorization': auth,
                'x-ms-date': UTCstring,
            },
            notification: {
                enabled: true
            }
        }
        const uploadId =await  Upload.startUpload(options);
        return new BlobResponse(uploadId,authparam.filename)
    }
}


class AuthParam implements IAuthParam {
    request: string;
    length: number;
    contentType: string;
    version: string;
    filename: string;
    storagekey: string;
    account: string;
    container: string;
    date: string;
    blobtype: string;
}


interface IAuthParam {
    request: string,
    length: number,
    contentType: string,
    version: string,
    filename: string,
    storagekey: string,
    account: string,
    container: string,
    date: string,
    blobtype: string
}

export const authHead = (param: IAuthParam) => {
    var signatureParts = [
        "PUT",
        "",
        "",
        param.length,
        "",
        param.contentType,
        "",
        "",
        "",
        "",
        "",
        "",
        `x-ms-blob-type:${param.blobtype}`,
        `x-ms-date:${param.date}`,
        `x-ms-version:${param.version}`,
        `/${param.account}/${param.container}/${param.filename}`
    ];

    const signatureRaw = signatureParts.join("\n");
    console.log(signatureRaw)
    const storageKey = param.storagekey;
    const signatureBytes = CryptoJS.HmacSHA256(signatureRaw, CryptoJS.enc.Base64.parse(storageKey));
    const signatureEncoded = signatureBytes.toString(CryptoJS.enc.Base64);
    return `SharedKey ${param.account}:${signatureEncoded}`;
}

export const azureblobfetch = async (param: FetchParam) => {
    let loctor = AzureBlobLocator.getInstance();
    const reducer = loctor.Find(param.type);
    return reducer.azurBlobFetch(param)
}

