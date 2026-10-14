package io.github.alejandropico.lector;

import android.speech.tts.*;
import android.os.Bundle;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.media.MediaMetadata;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;

@CapacitorPlugin(name="LectorSpeech")
public class LectorSpeechPlugin extends Plugin {
  private TextToSpeech engine;private boolean ready=false,failed=false,paused=false;private String id,token,text="";private int offset=0,word=0,sequence=0;private final List<Runnable> waiting=new ArrayList<>();private MediaSession media;private String title="Lector",artist="";
  @Override public void load(){
    media=new MediaSession(getContext(),"Lector");media.setCallback(new MediaSession.Callback(){@Override public void onPause(){pauseEngine();action("pause");}@Override public void onPlay(){resumeEngine();action("play");}@Override public void onStop(){cancelEngine();action("stop");}});
    engine=new TextToSpeech(getContext(),status->{getActivity().runOnUiThread(()->{ready=status==TextToSpeech.SUCCESS;failed=!ready;for(Runnable task:new ArrayList<>(waiting))task.run();waiting.clear();});});
    engine.setOnUtteranceProgressListener(new UtteranceProgressListener(){
      @Override public void onStart(String value){getActivity().runOnUiThread(()->{if(value.equals(token))event("start",0,0);});}
      @Override public void onRangeStart(String value,int start,int end,int frame){getActivity().runOnUiThread(()->{if(value.equals(token)&&!paused){word=offset+start;event("boundary",word,end-start);}});}
      @Override public void onDone(String value){getActivity().runOnUiThread(()->{if(value.equals(token)&&!paused){event("end",0,0);id=null;token=null;}});}
      @Override public void onError(String value){getActivity().runOnUiThread(()->{if(value.equals(token)){event("error",0,0);id=null;token=null;}});}
    });
  }
  private void whenReady(Runnable task){getActivity().runOnUiThread(()->{if(ready||failed)task.run();else waiting.add(task);});}
  private void event(String type,int index,int length){String current=id;if(current==null)return;JSObject data=new JSObject();data.put("id",current);data.put("type",type);data.put("charIndex",index);data.put("charLength",length);data.put("error","native-engine-unavailable");notifyListeners("speechEvent",data);}
  private void action(String action){JSObject data=new JSObject();data.put("type","action");data.put("action",action);notifyListeners("speechEvent",data);}
  private void state(boolean playing){if(playing){android.content.Intent service=new android.content.Intent(getContext(),LectorAudioService.class);service.putExtra("title",title);service.putExtra("artist",artist);service.putExtra("token",media.getSessionToken());getContext().startForegroundService(service);}media.setActive(id!=null);media.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_STOP).setState(playing?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,PlaybackState.PLAYBACK_POSITION_UNKNOWN,1).build());}
  @PluginMethod public void voices(PluginCall call){whenReady(()->{JSArray result=new JSArray();if(ready&&engine.getVoices()!=null){List<Voice> voices=new ArrayList<>(engine.getVoices());voices.sort(Comparator.comparing(Voice::getName));Map<String,Integer> variants=new HashMap<>();for(Voice voice:voices){if(voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))continue;String label=voice.getLocale().getDisplayName();int variant=variants.merge(label,1,Integer::sum);JSObject item=new JSObject();item.put("name",label+" · "+variant);item.put("voiceURI",voice.getName());item.put("lang",voice.getLocale().toLanguageTag());item.put("localService",!voice.isNetworkConnectionRequired());item.put("default",engine.getVoice()!=null&&voice.getName().equals(engine.getVoice().getName()));result.put(item);}}JSObject data=new JSObject();data.put("voices",result);call.resolve(data);});}
  @PluginMethod public void speak(PluginCall call){whenReady(()->{if(!ready){call.reject("No hay un motor de voz disponible.");return;}cancelEngine(false);id=call.getString("id");text=call.getString("text","");offset=word=0;paused=call.getBoolean("paused",false);engine.setLanguage(Locale.forLanguageTag(call.getString("language","es")));String selected=call.getString("voice","");if(engine.getVoices()!=null)for(Voice voice:engine.getVoices())if(voice.getName().equals(selected))engine.setVoice(voice);engine.setSpeechRate(call.getFloat("rate",1f));engine.setPitch(call.getFloat("pitch",1f));Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,call.getFloat("volume",1f));token=id+":"+(++sequence);state(!paused);if(!paused&&engine.speak(text,TextToSpeech.QUEUE_FLUSH,params,token)==TextToSpeech.ERROR){event("error",0,0);cancelEngine();}call.resolve();});}
  private void pauseEngine(){if(id==null||paused)return;paused=true;offset=word;token=null;engine.stop();state(false);}
  private void resumeEngine(){if(id==null||!paused)return;paused=false;token=id+":"+(++sequence);state(true);engine.speak(text.substring(Math.min(offset,text.length())),TextToSpeech.QUEUE_FLUSH,null,token);}
  private void cancelEngine(){cancelEngine(true);}private void cancelEngine(boolean release){id=null;token=null;paused=false;if(engine!=null)engine.stop();if(media!=null)media.setActive(false);if(release)getContext().stopService(new android.content.Intent(getContext(),LectorAudioService.class));}
  @PluginMethod public void pause(PluginCall call){getActivity().runOnUiThread(()->{pauseEngine();call.resolve();});}
  @PluginMethod public void resume(PluginCall call){getActivity().runOnUiThread(()->{resumeEngine();call.resolve();});}
  @PluginMethod public void cancel(PluginCall call){getActivity().runOnUiThread(()->{cancelEngine();call.resolve();});}
  @PluginMethod public void metadata(PluginCall call){title=call.getString("title","Lector");artist=call.getString("artist","");MediaMetadata.Builder value=new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,call.getString("title","")).putString(MediaMetadata.METADATA_KEY_ARTIST,call.getString("artist",""));try{byte[] bytes=Base64.decode(call.getString("cover",""),Base64.DEFAULT);value.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,BitmapFactory.decodeByteArray(bytes,0,bytes.length));}catch(Exception ignored){}media.setMetadata(value.build());call.resolve();}
  @Override protected void handleOnDestroy(){cancelEngine();if(engine!=null)engine.shutdown();if(media!=null)media.release();}
}
