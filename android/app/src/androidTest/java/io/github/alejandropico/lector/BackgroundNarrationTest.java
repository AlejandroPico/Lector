package io.github.alejandropico.lector;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.session.*;
import android.os.*;
import android.speech.tts.*;
import android.graphics.*;
import android.util.Base64;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.util.*;
import java.util.concurrent.*;
import java.lang.reflect.*;
import java.io.*;

/** Real Android service/session/notification, deterministic speech engine, no JS client. */
@RunWith(AndroidJUnit4.class)
public class BackgroundNarrationTest {
  private LectorAudioService service;
  private ActivityScenario<MainActivity> activity;
  private Context context;
  private ServiceConnection connection;
  private FakeSpeech fake;
  private void main(Runnable task){InstrumentationRegistry.getInstrumentation().runOnMainSync(task);}
  private Object field(String name)throws Exception{Field f=LectorAudioService.class.getDeclaredField(name);f.setAccessible(true);return f.get(service);}
  private void field(String name,Object value)throws Exception{Field f=LectorAudioService.class.getDeclaredField(name);f.setAccessible(true);f.set(service,value);}
  private void await(java.util.function.BooleanSupplier condition)throws Exception{long until=System.currentTimeMillis()+8000;while(!condition.getAsBoolean()&&System.currentTimeMillis()<until)Thread.sleep(40);assertTrue(condition.getAsBoolean());}
  private JSObject state(){final JSObject[] result={null};main(()->result[0]=service.status());return result[0];}
  static class FakeSpeech extends TextToSpeech {
    String lastText,lastToken;
    final Voice voice=new Voice("test-es",new Locale("es","ES"),Voice.QUALITY_NORMAL,Voice.LATENCY_NORMAL,false,Collections.emptySet());
    FakeSpeech(Context context){super(context,status->{});}
    @Override public Set<Voice> getVoices(){return Collections.singleton(voice);}
    @Override public int setLanguage(Locale locale){return LANG_AVAILABLE;}
    @Override public int setVoice(Voice voice){return SUCCESS;}
    @Override public int setSpeechRate(float value){return SUCCESS;}
    @Override public int setPitch(float value){return SUCCESS;}
    @Override public int stop(){return SUCCESS;}
    @Override public int speak(CharSequence text,int mode,Bundle params,String id){lastText=text.toString();lastToken=id;return SUCCESS;}
  }
  @Before public void setup()throws Exception{
    context=InstrumentationRegistry.getInstrumentation().getTargetContext();activity=ActivityScenario.launch(MainActivity.class);
    CountDownLatch bound=new CountDownLatch(1);connection=new ServiceConnection(){@Override public void onServiceConnected(ComponentName name,IBinder binder){service=((LectorAudioService.LocalBinder)binder).service();bound.countDown();}@Override public void onServiceDisconnected(ComponentName name){}};
    context.bindService(new Intent(context,LectorAudioService.class),connection,Context.BIND_AUTO_CREATE);assertTrue(bound.await(15,TimeUnit.SECONDS));
    CountDownLatch ready=new CountDownLatch(1);main(()->service.whenReady(ready::countDown));assertTrue(ready.await(20,TimeUnit.SECONDS));
    main(()->{try{((TextToSpeech)field("engine")).shutdown();fake=new FakeSpeech(context);field("engine",fake);field("ready",true);field("failed",false);service.detach();}catch(Exception error){throw new RuntimeException(error);}});
  }
  @After public void cleanup()throws Exception{
    if(service!=null)main(()->service.stopReading("stopped"));
    try(ParcelFileDescriptor command=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent KEYCODE_WAKEUP")){}
    if(connection!=null)context.unbindService(connection);if(activity!=null)activity.close();
  }
  @Test public void pauseDuringPreparationDoesNotStartAudio()throws Exception{
    JSArray items=new JSArray();JSObject item=new JSObject();item.put("text","Lectura que no debe comenzar hasta reanudar.");item.put("voice","test-es");items.put(item);
    CountDownLatch started=new CountDownLatch(1);main(()->{service.start("prepare","book",items,false,0,error->started.countDown());service.pause();});assertTrue(started.await(10,TimeUnit.SECONDS));
    assertEquals("paused",state().getString("state"));assertNull(fake.lastToken);main(()->service.resume());await(()->"playing".equals(state().getString("state")));assertNotNull(fake.lastToken);
  }

  @Test public void nativeSleepTimerExpiresWithoutAClient()throws Exception{
    JSArray items=new JSArray();JSObject item=new JSObject();item.put("text","Una frase larga para probar el temporizador nativo.");item.put("voice","test-es");items.put(item);
    CountDownLatch started=new CountDownLatch(1);main(()->{service.visible(false);service.start("timer","book",items,false,System.currentTimeMillis()+600,error->started.countDown());});assertTrue(started.await(10,TimeUnit.SECONDS));
    await(()->"stopped".equals(state().getString("state")));assertEquals("sleep",state().getString("reason"));assertFalse(((PowerManager.WakeLock)field("wake")).isHeld());
  }

  @Test public void lockedScreenQueueAndNotificationControlsWorkWithoutJavaScript()throws Exception{
    String longText=String.join(" ",Collections.nCopies(80,"palabra"));JSArray items=new JSArray();
    for(int i=0;i<3;i++){JSObject item=new JSObject();item.put("text",longText);item.put("chapter","Capítulo "+i);item.put("language","es-ES");item.put("voice","test-es");item.put("cfi","epubcfi(/6/"+(2+i*2)+")");item.put("wpm",120);items.put(item);}
    Bitmap bitmap=Bitmap.createBitmap(32,48,Bitmap.Config.ARGB_8888);bitmap.eraseColor(0xff336655);ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,bytes);
    CountDownLatch started=new CountDownLatch(1);String[] failure={null};main(()->{service.metadata("Libro de prueba","Autora",Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP));service.start("test-queue","book",items,false,0,error->{failure[0]=error;started.countDown();});});assertTrue(started.await(10,TimeUnit.SECONDS));assertNull(failure[0]);
    try(ParcelFileDescriptor command=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent KEYCODE_SLEEP")){}
    await(()->!context.getSystemService(PowerManager.class).isInteractive());
    main(()->{service.visible(false);service.detach();});
    UtteranceProgressListener progress=(UtteranceProgressListener)field("progress");String first=fake.lastToken;progress.onDone(first);await(()->state().getInteger("item",-1)==1);
    String second=fake.lastToken;progress.onDone(second);await(()->state().getInteger("item",-1)==2);
    MediaSession media=(MediaSession)field("media");assertEquals("Libro de prueba",media.getController().getMetadata().getString(MediaMetadata.METADATA_KEY_TITLE));assertEquals("Capítulo 2",media.getController().getMetadata().getString(MediaMetadata.METADATA_KEY_ALBUM));assertNotNull(media.getController().getMetadata().getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART));
    NotificationManager notices=context.getSystemService(NotificationManager.class);Notification notice=Arrays.stream(notices.getActiveNotifications()).filter(n->n.getId()==18).findFirst().get().getNotification();assertEquals(3,notice.actions.length);
    notice.actions[1].actionIntent.send();await(()->"paused".equals(state().getString("state")));assertFalse(((PowerManager.WakeLock)field("wake")).isHeld());
    MediaController.TransportControls controls=media.getController().getTransportControls();controls.rewind();await(()->state().getInteger("item",-1)==1);int offset=state().getInteger("charIndex",0);controls.rewind();await(()->state().getInteger("charIndex",0)<offset);assertEquals("paused",state().getString("state"));
    controls.play();await(()->"playing".equals(state().getString("state")));assertTrue(((PowerManager.WakeLock)field("wake")).isHeld());
    // A callback from the pre-rewind utterance must not advance the new cursor.
    int before=state().getInteger("item",-1);progress.onDone(second);Thread.sleep(120);assertEquals(before,state().getInteger("item",-1).intValue());
    controls.stop();await(()->"stopped".equals(state().getString("state")));assertFalse(((PowerManager.WakeLock)field("wake")).isHeld());assertEquals(0,notices.getActiveNotifications().length);
    assertTrue(context.getSharedPreferences("narration",Context.MODE_PRIVATE).getString("checkpoint","").contains("book"));
  }
}
