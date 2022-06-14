// @ts-nocheck
// Move to native implementation when node 14 is off lts
import {Crypto} from '@peculiar/webcrypto'
export const crypto = new Crypto()
