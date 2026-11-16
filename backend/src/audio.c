/* Bounded RIFF/WAVE analysis. No external decoder; estimates never overwrite metadata. */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
static unsigned u16(const unsigned char *p){return (unsigned)p[0]|((unsigned)p[1]<<8);}
static uint32_t u32(const unsigned char *p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static int fail(const char *s){fprintf(stderr,"%s\n",s);return 2;}
int main(int argc,char **argv){
 if(argc!=2)return fail("Expected a WAV path");
 FILE *f=fopen(argv[1],"rb");if(!f)return fail("Cannot open audio");
 if(fseek(f,0,SEEK_END)){fclose(f);return 2;}long length=ftell(f);rewind(f);
 if(length<44||length>104857600){fclose(f);return fail("WAV must be 44 bytes to 100 MB");}
 unsigned char *bytes=malloc((size_t)length);if(!bytes){fclose(f);return 2;}
 if(fread(bytes,1,(size_t)length,f)!=(size_t)length){free(bytes);fclose(f);return 2;}fclose(f);
 if(memcmp(bytes,"RIFF",4)||memcmp(bytes+8,"WAVE",4)||u32(bytes+4)!=(uint32_t)length-8){free(bytes);return fail("Invalid RIFF/WAVE length");}
 unsigned format=0,channels=0,rate=0,bits=0,align=0;size_t offset=12,dataOffset=0,dataLength=0;
 while(offset+8<=(size_t)length){uint32_t size=u32(bytes+offset+4);size_t begin=offset+8;if(size>(size_t)length-begin){free(bytes);return fail("Truncated WAV chunk");}
  if(!memcmp(bytes+offset,"fmt ",4)){if(size<16){free(bytes);return 2;}format=u16(bytes+begin);channels=u16(bytes+begin+2);rate=u32(bytes+begin+4);align=u16(bytes+begin+12);bits=u16(bytes+begin+14);}
  else if(!memcmp(bytes+offset,"data",4)){dataOffset=begin;dataLength=size;}
  offset=begin+size+(size&1u);
 }
 if(!dataOffset||!dataLength||channels<1||channels>8||rate<8000||rate>192000||!((format==1&&(bits==16||bits==24||bits==32))||(format==3&&bits==32))||align!=channels*(bits/8)||dataLength%align){free(bytes);return fail("Supported WAV: PCM16/24/32 or float32, 1-8 channels, 8-192 kHz");}
 size_t frames=dataLength/align;double duration=(double)frames/rate;if(duration>7200){free(bytes);return fail("Audio exceeds two hours");}
 unsigned hop=rate/100;size_t windows=(frames+hop-1)/hop;double *envelope=calloc(windows,sizeof *envelope);if(!envelope){free(bytes);return 2;}
 double sum=0,peak=0,waveform[128]={0};size_t clipped=0;
 for(size_t frame=0;frame<frames;frame++)for(unsigned ch=0;ch<channels;ch++){
  const unsigned char *p=bytes+dataOffset+frame*align+ch*(bits/8);double value;
  if(format==3){uint32_t raw=u32(p);float sample;memcpy(&sample,&raw,4);if(!isfinite(sample)||fabsf(sample)>1){free(envelope);free(bytes);return fail("Float samples must be finite and normalized");}value=sample;}
  else if(bits==16)value=(int16_t)u16(p)/32768.0;
  else if(bits==24){int32_t raw=(int32_t)((uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16));if(raw&0x800000)raw-=0x1000000;value=raw/8388608.0;}
  else value=(int32_t)u32(p)/2147483648.0;
  double amplitude=fabs(value);sum+=value*value;envelope[frame/hop]+=value*value;if(amplitude>peak)peak=amplitude;if(amplitude>=.999)clipped++;
  size_t bin=frame*128/frames;if(amplitude>waveform[bin])waveform[bin]=amplitude;
 }
 free(bytes);double maximum=0;for(size_t i=0;i<windows;i++){size_t count=(i+1)*hop<=frames?hop:frames-i*hop;envelope[i]=sqrt(envelope[i]/(count*channels));if(envelope[i]>maximum)maximum=envelope[i];}
 double previous=envelope[0],onsetPower=0;
 for(size_t i=0;i<windows;i++){double current=envelope[i],change=current-previous;envelope[i]=change>maximum*.03?change:0;onsetPower+=envelope[i]*envelope[i];previous=current;}
 double best=0;int bestLag=0;
 if(duration>=8&&onsetPower>1e-8){int low=(int)ceil(60.0*rate/(hop*240.0)),high=(int)floor(60.0*rate/(hop*40.0));for(int lag=low;lag<=high;lag++){double product=0,a=0,b=0;for(size_t i=(size_t)lag;i<windows;i++){product+=envelope[i]*envelope[i-lag];a+=envelope[i]*envelope[i];b+=envelope[i-lag]*envelope[i-lag];}double score=(a>0&&b>0)?product/sqrt(a*b):0;if(score>best+1e-6){best=score;bestLag=lag;}}}
 free(envelope);double rms=sqrt(sum/(frames*channels));
 printf("{\"version\":1,\"method\":\"wav-rms-onset-autocorrelation\",\"durationSeconds\":%.6f,\"sampleRate\":%u,\"channels\":%u,\"rms\":%.8f,\"rmsDbfs\":%.4f,\"peak\":%.8f,\"clippedFraction\":%.8f,\"tempoBpm\":",duration,rate,channels,rms,rms>1e-6?20*log10(rms):-120,peak,(double)clipped/(frames*channels));
 if(bestLag&&best>=.25)printf("%.3f",60.0*rate/(hop*bestLag));else printf("null");
 printf(",\"tempoConfidence\":%.6f,\"tempoConfidenceCalibrated\":false,\"waveform\":[",bestLag?best:0);
 for(int i=0;i<128;i++)printf("%s%.5f",i?",":"",waveform[i]);
 puts("],\"limitations\":[\"Tempo may be half/double time; confidence is periodicity, not calibrated accuracy.\",\"RMS dBFS is not LUFS or perceived loudness.\",\"Mood, danceability, genre and calibrated energy are not inferred.\"]}");return 0;
}
