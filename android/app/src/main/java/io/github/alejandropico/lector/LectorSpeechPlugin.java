package io.github.alejandropico.lector;

import android.content.*;
import android.os.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;

/** Thin UI bridge. Destroying the WebView does not destroy active playback. */
@CapacitorPlugin(name="LectorSpeech")
public class LectorSpeechPlugin extends Plugin {
  private LectorAudioService service;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final List<Runnable> waiting=new ArrayList<>();
  private boolean bound;
  private final ServiceConnection connection=new ServiceConnection(){
    @Override public void onServiceConnected(ComponentName name,IBinder binder){service=((LectorAudioService.LocalBinder)binder).service();service.attach(data->notifyListeners("speechEvent",data));for(Runnable task:new ArrayList<>(waiting))task.run();waiting.clear();}
    @Override public void onServiceDisconnected(ComponentName name){service=null;}
  };
  @Override public void load(){bound=getContext().bindService(new Intent(getContext(),LectorAudioService.class),connection,Context.BIND_AUTO_CREATE);}
  private void connected(Runnable task){handler.post(()->{if(service!=null)task.run();else waiting.add(task);});}
  @PluginMethod public void voices(PluginCall call){connected(()->service.whenReady(()->{JSObject result=new JSObject();result.put("voices",service.voices());call.resolve(result);}));}
  @PluginMethod public void startQueue(PluginCall call){connected(()->service.start(call.getString("id"),call.getString("bookId",""),call.getArray("items",new JSArray()),call.getBoolean("paused",false),call.getLong("deadline",0L),error->{if(error==null)call.resolve();else call.reject(error);}));}
  @PluginMethod public void speak(PluginCall call){connected(()->{JSArray items=new JSArray();items.put(call.getData());service.start(call.getString("id"),"",items,call.getBoolean("paused",false),0,error->{if(error==null)call.resolve();else call.reject(error);});});}
  @PluginMethod public void pause(PluginCall call){connected(()->{service.pause();call.resolve();});}
  @PluginMethod public void resume(PluginCall call){connected(()->{service.resume();call.resolve();});}
  @PluginMethod public void rewind(PluginCall call){connected(()->{service.rewind();call.resolve();});}
  @PluginMethod public void configure(PluginCall call){connected(()->{service.configure(call.getObject("characters",new JSObject()),call.getLong("deadline",0L));call.resolve();});}
  @PluginMethod public void cancel(PluginCall call){connected(()->{service.stopReading("stopped");call.resolve();});}
  @PluginMethod public void status(PluginCall call){connected(()->call.resolve(service.status()));}
  @PluginMethod public void checkpoint(PluginCall call){handler.post(()->{try{call.resolve(new JSObject(getContext().getSharedPreferences("narration",Context.MODE_PRIVATE).getString("checkpoint","{}")));}catch(Exception error){call.resolve(new JSObject());}});}
  @PluginMethod public void metadata(PluginCall call){connected(()->{service.metadata(call.getString("title","Lector"),call.getString("artist",""),call.getString("cover",""));call.resolve();});}
  @Override protected void handleOnPause(){handler.post(()->{if(service!=null)service.visible(false);});}
  @Override protected void handleOnResume(){handler.post(()->{if(service!=null)service.visible(true);});}
  @Override protected void handleOnDestroy(){handler.post(()->{if(service!=null)service.detach();if(bound)getContext().unbindService(connection);bound=false;service=null;waiting.clear();});}
}
