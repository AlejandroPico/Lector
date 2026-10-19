package io.github.alejandropico.lector;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.media.*;
import android.media.session.*;
import android.os.*;
import android.speech.tts.*;
import android.util.Base64;
import com.getcapacitor.*;
import org.json.*;
import java.util.*;
import java.util.function.Consumer;
import java.util.concurrent.*;

/** Synthesis, the reading queue and transport controls belong to the service, not the Activity. */
public class LectorAudioService extends Service {
  static final String PLAY="lector.play",PAUSE="lector.pause",REWIND="lector.rewind",STOP="lector.stop";
  private static final int NOTICE=18;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ExecutorService preparation=Executors.newSingleThreadExecutor();
  private long preparationId;
  private boolean preparing,preparationPaused;
  private JSObject preparationConfig;
  private long preparationDeadline;
  private String preparationSession,preparationBook;
  private final IBinder binder=new LocalBinder();
  class LocalBinder extends Binder { LectorAudioService service(){return LectorAudioService.this;} }
  private TextToSpeech engine;
  private UtteranceProgressListener progress;
  private boolean ready,failed,paused,foreground,hasFocus,hadBoundary,visible=true;
  private JSObject terminal;
  private final List<Runnable> waiting=new ArrayList<>();
  private MediaSession media;
  private AudioManager audio;
  private AudioFocusRequest focus;
  private PowerManager.WakeLock wake;
  private NarrationQueue queue;
  private String sessionId,bookId="",token,title="Lector",artist="",chapter="";
  private Bitmap cover;
  private long sequence,startedAt,lastSave;
  private int startedOffset;
  private Consumer<JSObject> listener;
  private final Runnable sleep=()->stopReading("sleep");
  private final BroadcastReceiver noisy=new BroadcastReceiver(){@Override public void onReceive(Context context,Intent intent){pause();}};

  @Override public IBinder onBind(Intent intent){return binder;}
  @Override public void onCreate(){
    super.onCreate();audio=getSystemService(AudioManager.class);
    wake=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Lector:Narration");wake.setReferenceCounted(false);
    AudioAttributes attributes=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes).setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(change->{if(change<0){hasFocus=false;pause();}},handler).build();
    media=new MediaSession(this,"Lector");
    media.setCallback(new MediaSession.Callback(){
      @Override public void onPlay(){resume();}
      @Override public void onPause(){pause();}
      @Override public void onStop(){stopReading("stopped");}
      @Override public void onRewind(){rewind();}
      @Override public void onSkipToPrevious(){rewind();}
      @Override public void onCustomAction(String action,Bundle extras){if(REWIND.equals(action))rewind();}
    },handler);
    IntentFilter filter=new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
    if(Build.VERSION.SDK_INT>=33)registerReceiver(noisy,filter,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(noisy,filter);
    engine=new TextToSpeech(getApplicationContext(),status->handler.post(()->{ready=status==TextToSpeech.SUCCESS;failed=!ready;if(ready)engine.setAudioAttributes(attributes);for(Runnable task:new ArrayList<>(waiting))task.run();waiting.clear();}));
    progress=new UtteranceProgressListener(){
      @Override public void onStart(String value){handler.post(()->{if(value.equals(token)){startedAt=SystemClock.elapsedRealtime();emit("start",0);}});}
      @Override public void onRangeStart(String value,int start,int end,int frame){handler.post(()->{if(value.equals(token)&&!paused&&queue!=null){hadBoundary=true;queue.boundary(startedOffset+start);checkpoint(false);emit("boundary",end-start);}});}
      @Override public void onDone(String value){handler.post(()->{if(value.equals(token)&&!paused&&queue!=null){
        // No JavaScript callback is needed to reach the next sentence or chapter.
        if(queue.next())speakCurrent();else stopReading("end");
      }});}
      @Override public void onError(String value){onError(value,TextToSpeech.ERROR);}
      @Override public void onError(String value,int code){handler.post(()->{if(value.equals(token))fail("synthesis-failed");});}
    };engine.setOnUtteranceProgressListener(progress);
    getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel("lectura","Lector",NotificationManager.IMPORTANCE_LOW));
  }
  void attach(Consumer<JSObject> listener){this.listener=listener;}
  void detach(){listener=null;}
  void visible(boolean value){visible=value;}
  void whenReady(Runnable task){if(ready||failed)task.run();else waiting.add(task);}
  JSArray voices(){
    JSArray result=new JSArray();if(!ready||engine.getVoices()==null)return result;
    List<Voice> voices=new ArrayList<>(engine.getVoices());voices.sort(Comparator.comparing(Voice::getName));Map<String,Integer> variants=new HashMap<>();
    for(Voice voice:voices){if(voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))continue;
      String label=voice.getLocale().getDisplayName();int variant=variants.merge(label,1,Integer::sum);JSObject item=new JSObject();
      item.put("name",label+" · "+variant);item.put("voiceURI",voice.getName());item.put("lang",voice.getLocale().toLanguageTag());item.put("localService",!voice.isNetworkConnectionRequired());item.put("default",engine.getVoice()!=null&&voice.getName().equals(engine.getVoice().getName()));result.put(item);
    }return result;
  }
  void start(String id,String book,JSArray input,boolean pause,long deadline,Consumer<String> result){
    final long request=++preparationId;
    preparing=true;preparationPaused=pause;preparationConfig=null;preparationSession=id;preparationBook=book;
    whenReady(()->{
      if(request!=preparationId){result.accept("cancelled");return;}
      if(!ready){result.accept("native-engine-unavailable");return;}
      Set<String> installed=new HashSet<>();if(engine.getVoices()!=null)for(Voice voice:engine.getVoices())if(!voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))installed.add(voice.getName());
      preparation.execute(()->{
      List<NarrationQueue.Item> items=new ArrayList<>();
      try{for(int i=0;i<input.length();i++){
        JSONObject item=input.getJSONObject(i);String text=item.getString("text");
        if(text.trim().isEmpty()||text.length()>TextToSpeech.getMaxSpeechInputLength())throw new IllegalArgumentException();
        String voice=item.optString("voice","");
        if(!voice.isEmpty()&&!installed.contains(voice)){handler.post(()->result.accept("voice-unavailable"));return;}
        NarrationQueue.Item value=new NarrationQueue.Item(text,item.optString("language","es"),voice,item.optString("cfi",""),item.optString("chapter",""),
          (float)Math.max(.5,Math.min(2,item.optDouble("rate",1))),(float)Math.max(.5,Math.min(1.5,item.optDouble("pitch",1))),(float)Math.max(0,Math.min(1,item.optDouble("volume",1))),item.optInt("wpm",170));value.characterId=item.optString("characterId","narrator");items.add(value);
      }}catch(Exception invalid){handler.post(()->result.accept("invalid-narration-queue"));return;}
      if(items.isEmpty()){handler.post(()->result.accept("invalid-narration-queue"));return;}
      handler.post(()->{
      if(request!=preparationId){result.accept("cancelled");return;}
      boolean requestedPause=preparationPaused;JSObject config=preparationConfig;long configuredDeadline=preparationDeadline;
      stopReading("replaced");terminal=null;sessionId=id;bookId=book;queue=new NarrationQueue(items);paused=requestedPause;
      if(deadline>0){if(deadline<=System.currentTimeMillis()){stopReading("sleep");result.accept(null);return;}handler.postDelayed(sleep,deadline-System.currentTimeMillis());}
      if(config!=null)configure(config,configuredDeadline);
      try{
        // Acquire foreground status before requesting focus (required when targeting Android 15+).
        startForegroundService(new Intent(this,LectorAudioService.class));foreground=true;updateNotice();media.setActive(true);
        if(!paused)speakCurrent();else publishState();result.accept(null);
      }catch(Exception denied){stopReading("error");result.accept("background-playback-unavailable");}
      });
      });
    });
  }
  private void speakCurrent(){
    NarrationQueue.Item item=queue==null?null:queue.current();if(item==null||paused)return;
    token=null;engine.stop();
    if(!hasFocus){hasFocus=audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;if(!hasFocus){fail("audio-focus-denied");return;}}
    int language=engine.setLanguage(Locale.forLanguageTag(item.language));
    if(!item.voice.isEmpty()){
      Voice selected=engine.getVoices()==null?null:engine.getVoices().stream().filter(v->v.getName().equals(item.voice)).findFirst().orElse(null);
      if(selected==null||engine.setVoice(selected)==TextToSpeech.ERROR){fail("voice-unavailable");return;}
    }else if(language==TextToSpeech.LANG_MISSING_DATA||language==TextToSpeech.LANG_NOT_SUPPORTED){fail("language-unavailable");return;}
    engine.setSpeechRate(item.rate);engine.setPitch(item.pitch);
    if(queue.offset>=item.text.length()){if(queue.next())speakCurrent();else stopReading("end");return;}
    token=sessionId+":"+(++sequence);startedOffset=queue.offset;hadBoundary=false;startedAt=SystemClock.elapsedRealtime();
    chapter=item.chapter;updateMetadata();publishState();checkpoint(true);
    if(!wake.isHeld())wake.acquire();
    Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,item.volume);
    if(engine.speak(item.text.substring(startedOffset),TextToSpeech.QUEUE_FLUSH,params,token)==TextToSpeech.ERROR)fail("synthesis-failed");
  }
  private void estimateOffset(){if(queue==null||queue.current()==null||paused||hadBoundary)return;
    NarrationQueue.Item item=queue.current();int estimate=startedOffset+(int)((SystemClock.elapsedRealtime()-startedAt)*(double)item.text.length()/item.duration);queue.boundary(item.wordStart(Math.min(item.text.length(),estimate)));
  }
  void pause(){if(preparing){preparationPaused=true;return;}if(queue==null||paused)return;estimateOffset();paused=true;token=null;engine.stop();releaseResources();checkpoint(true);publishState();emit("state",0);}
  void configure(JSObject characters,long deadline){
    if(preparing){preparationConfig=characters;preparationDeadline=deadline;return;}
    handler.removeCallbacks(sleep);if(deadline>0)handler.postDelayed(sleep,Math.max(0,deadline-System.currentTimeMillis()));
    if(queue==null)return;
    // Apply voice controls to subsequent fragments without cancelling the current utterance.
    for(int i=queue.index+1;i<queue.items.size();i++){
      NarrationQueue.Item before=queue.items.get(i);JSONObject config=characters.optJSONObject(before.characterId);if(config==null)config=characters.optJSONObject("narrator");if(config==null)continue;
      NarrationQueue.Item after=new NarrationQueue.Item(before.text,config.optString("language",before.language),config.optString("voice",before.voice),before.cfi,before.chapter,(float)config.optDouble("rate",before.rate),(float)config.optDouble("pitch",before.pitch),before.volume,config.optInt("wpm",170));after.characterId=before.characterId;queue.items.set(i,after);
    }
  }
  void resume(){if(preparing){preparationPaused=false;return;}if(queue==null||!paused)return;paused=false;speakCurrent();emit("state",0);}
  void rewind(){rewind(10);}
  void rewind(int seconds){if(queue==null)return;estimateOffset();token=null;engine.stop();if(seconds<=0){queue.index=Math.max(0,queue.index-1);queue.offset=0;}else queue.rewind(Math.min(120,seconds)*1000L);checkpoint(true);if(!paused)speakCurrent();else{chapter=queue.current().chapter;updateMetadata();publishState();}emit("position",0);}
  void stopReading(String reason){
    preparationId++;
    preparing=false;preparationConfig=null;
    if(queue!=null){estimateOffset();checkpoint(true);}
    String previous=sessionId;token=null;queue=null;paused=false;handler.removeCallbacks(sleep);
    if(engine!=null)engine.stop();releaseResources();
    if(media!=null){media.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_STOPPED,PlaybackState.PLAYBACK_POSITION_UNKNOWN,0).build());media.setActive(false);}
    if(foreground){stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;stopSelf();}
    if(previous!=null&&!reason.equals("error")){JSObject data=new JSObject();data.put("id",previous);data.put("type",reason.equals("end")?"end":"stopped");data.put("reason",reason);data.put("state","stopped");terminal=data;if(listener!=null&&visible)listener.accept(data);}sessionId=null;
  }
  private void releaseResources(){if(wake!=null&&wake.isHeld())wake.release();if(audio!=null&&hasFocus){audio.abandonAudioFocusRequest(focus);hasFocus=false;}}
  private void fail(String error){String id=sessionId;stopReading("error");if(id!=null){JSObject data=new JSObject();data.put("id",id);data.put("type","error");data.put("error",error);data.put("state","stopped");terminal=data;if(listener!=null&&visible)listener.accept(data);}}
  JSObject status(){if(preparing){JSObject pending=new JSObject();pending.put("id",preparationSession);pending.put("bookId",preparationBook);pending.put("state",preparationPaused?"paused":"loading");return pending;}if(queue==null&&terminal!=null)return terminal;JSObject data=new JSObject();data.put("id",sessionId);data.put("bookId",bookId);data.put("state",queue==null?"stopped":paused?"paused":"playing");data.put("item",queue==null?-1:queue.index);data.put("charIndex",queue==null?0:queue.offset);data.put("cfi",queue==null||queue.current()==null?"":queue.current().cfi);data.put("chapter",chapter);return data;}
  private void emit(String type,int length){if(listener!=null&&visible&&sessionId!=null){JSObject data=status();data.put("type",type);data.put("charLength",length);listener.accept(data);}}
  private void checkpoint(boolean force){if(queue==null||queue.current()==null||(!force&&SystemClock.elapsedRealtime()-lastSave<1500))return;lastSave=SystemClock.elapsedRealtime();JSObject data=status();data.put("updatedAt",System.currentTimeMillis());getSharedPreferences("narration",MODE_PRIVATE).edit().putString("checkpoint",data.toString()).apply();}
  void metadata(String title,String artist,String image){
    this.title=title;this.artist=artist;
    try{byte[] bytes=Base64.decode(image,Base64.DEFAULT);cover=BitmapFactory.decodeByteArray(bytes,0,bytes.length);}catch(Exception ignored){cover=null;}
    updateMetadata();if(foreground)updateNotice();
  }
  private void updateMetadata(){MediaMetadata.Builder value=new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title).putString(MediaMetadata.METADATA_KEY_ARTIST,artist).putString(MediaMetadata.METADATA_KEY_ALBUM,chapter).putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE,title).putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE,chapter).putString(MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION,artist);
    if(cover!=null)value.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,cover).putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON,cover);media.setMetadata(value.build());
  }
  private void publishState(){
    if(queue==null)return;
    long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_STOP|PlaybackState.ACTION_REWIND;
    media.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(paused?PlaybackState.STATE_PAUSED:PlaybackState.STATE_PLAYING,PlaybackState.PLAYBACK_POSITION_UNKNOWN,paused?0:1)
      .addCustomAction(new PlaybackState.CustomAction.Builder(REWIND,getString(R.string.audio_rewind),R.drawable.ic_audio_rewind).build()).build());
    if(foreground)updateNotice();
  }
  private PendingIntent command(String action,int request){return PendingIntent.getService(this,request,new Intent(this,LectorAudioService.class).setAction(action),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  private void updateNotice(){
    PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder notice=new Notification.Builder(this,"lectura").setSmallIcon(R.drawable.ic_stat_lector).setContentTitle(title).setContentText(chapter.isEmpty()?artist:chapter).setSubText(artist).setContentIntent(open).setOngoing(!paused).setShowWhen(false).setVisibility(Notification.VISIBILITY_PUBLIC).setCategory(Notification.CATEGORY_TRANSPORT)
      .addAction(new Notification.Action.Builder(R.drawable.ic_audio_rewind,getString(R.string.audio_rewind),command(REWIND,1)).build())
      .addAction(new Notification.Action.Builder(paused?R.drawable.ic_audio_play:R.drawable.ic_audio_pause,getString(paused?R.string.audio_play:R.string.audio_pause),command(paused?PLAY:PAUSE,2)).build())
      .addAction(new Notification.Action.Builder(R.drawable.ic_audio_stop,getString(R.string.audio_stop),command(STOP,3)).build())
      .setStyle(new Notification.MediaStyle().setMediaSession(media.getSessionToken()).setShowActionsInCompactView(0,1));
    if(cover!=null)notice.setLargeIcon(cover);
    startForeground(NOTICE,notice.build());
  }
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent!=null){String action=intent.getAction();if(PAUSE.equals(action))pause();else if(PLAY.equals(action))resume();else if(REWIND.equals(action))rewind();else if(STOP.equals(action))stopReading("stopped");}
    return START_NOT_STICKY;
  }
  @Override public void onDestroy(){listener=null;stopReading("stopped");preparation.shutdownNow();unregisterReceiver(noisy);if(engine!=null)engine.shutdown();if(media!=null)media.release();super.onDestroy();}
}
