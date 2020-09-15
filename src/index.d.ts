export interface JsonProperty {
  [key: string]: string | JsonProperty;
}
export declare function parse(text: string): JsonProperty;
export declare function enhancedParse(text: string): JsonProperty;
export declare function convertProperties(props: string): JsonProperty;
