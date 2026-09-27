export const fileKey = file => `${file?.name||""}:${file?.size||0}:${file?.lastModified||0}`;
export const formatBytes = bytes => { if(!bytes) return "0 B"; const units=["B","KB","MB","GB"]; const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1); return (bytes/1024**i).toFixed(i?2:0)+" "+units[i]; };
