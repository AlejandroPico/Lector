package io.github.alejandropico.lector;
import android.app.*;
import android.content.Intent;
import android.media.session.MediaSession;
import android.os.IBinder;

public class LectorAudioService extends Service {
  @Override public IBinder onBind(Intent intent){return null;}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    NotificationManager manager=getSystemService(NotificationManager.class);
    manager.createNotificationChannel(new NotificationChannel("lectura","Lector",NotificationManager.IMPORTANCE_LOW));
    PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder notice=new Notification.Builder(this,"lectura").setSmallIcon(R.drawable.ic_stat_lector).setContentTitle(intent.getStringExtra("title")).setContentText(intent.getStringExtra("artist")).setContentIntent(open).setOngoing(true).setShowWhen(false);
    MediaSession.Token token=intent.getParcelableExtra("token");
    if(token!=null)notice.setStyle(new Notification.MediaStyle().setMediaSession(token));
    startForeground(18,notice.build());return START_NOT_STICKY;
  }
}
