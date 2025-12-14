
export const HC2Utilities = {
  /**
   * 
   * @param {Number} timeout 
   * @returns {Promise<void>}
   */
  async sleep(timeout) {
    const p = new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });
    return p;
  },
  /**
   * Generates a sha256 hash
   * @param {String} str 
   * @returns {String}
   */
  async sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)));
  },
  /**
   * Generates a nonce
   * @returns {String}
   */
  generateNonce() {
    return [...crypto.getRandomValues(new Uint8Array(16))]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
  },
  /**
   * Helper methods for converting ArrayBuffer objects to specified types
   */
  ArrayBuffer: {
    /**
     * @param {ArrayBuffer} buffer
     * @returns {String}
     */
    toBase64(buffer) {
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },
    /**
     * @param {String} base64
     * @returns {ArrayBuffer}
     */
    fromBase64(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    },
    /** 
     * Convert an ArrayBuffer into a string
     * from https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
     * @param {ArrayBuffer} buf
     * @returns {String}
     */
    toString(buf) {
      return String.fromCharCode.apply(null, new Uint8Array(buf));
    }
  }
}