import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface NftMetadata {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  attributes?: { trait_type: string; value: string | number }[];
}

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly jwt = process.env.PINATA_JWT;

  async uploadNftMetadata(metadata: NftMetadata): Promise<string | null> {
    if (!this.jwt) {
      this.logger.warn('PINATA_JWT not set, skipping IPFS metadata upload');
      return null;
    }

    try {
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataContent: metadata,
          pinataMetadata: { name: `${metadata.name}.json` },
        },
        {
          headers: {
            Authorization: `Bearer ${this.jwt}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const cid = response.data.IpfsHash;
      this.logger.log(`NFT metadata uploaded to IPFS: ipfs://${cid}`);
      return `ipfs://${cid}`;
    } catch (err) {
      this.logger.error('IPFS metadata upload failed', err?.message);
      return null;
    }
  }

  buildMetadata(params: {
    title: string;
    description: string;
    fileType: string;
    priceEth: string;
    sellerWallet: string;
    tags: string[];
    imageUrl?: string;
    productId?: string;
  }): NftMetadata {
    const cfDomain = process.env.AWS_CLOUDFRONT_DOMAIN;

    return {
      name: params.title,
      description: params.description,
      ...(params.imageUrl && { image: params.imageUrl }),
      ...(params.productId && cfDomain && {
        external_url: `https://${cfDomain}/products/${params.productId}`,
      }),
      attributes: [
        { trait_type: 'File Type', value: params.fileType },
        { trait_type: 'Price (ETH)', value: params.priceEth },
        { trait_type: 'Seller', value: params.sellerWallet },
        ...(params.tags.length > 0
          ? [{ trait_type: 'Tags', value: params.tags.join(', ') }]
          : []),
      ],
    };
  }
}
