package io.github.alejandropico.lector;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.net.Uri;
import android.print.PrintManager;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONArray;
import java.io.OutputStream;

@CapacitorPlugin(name="LectorDevice")
public class LectorDevicePlugin extends Plugin {
  private boolean initialConsumed=false;
  @PluginMethod public void info(PluginCall call){JSObject result=new JSObject();UiModeManager mode=(UiModeManager)getContext().getSystemService(android.content.Context.UI_MODE_SERVICE);result.put("tv",mode.getCurrentModeType()==Configuration.UI_MODE_TYPE_TELEVISION||getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK));result.put("printing",getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_PRINTING));call.resolve(result);}
  private JSObject metadata(Uri uri)throws Exception{
    JSObject result=new JSObject();result.put("uri",uri.toString());result.put("type",getContext().getContentResolver().getType(uri));
    try(Cursor cursor=getContext().getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){if(cursor!=null&&cursor.moveToFirst()){result.put("name",cursor.getString(0));if(!cursor.isNull(1))result.put("size",cursor.getLong(1));}}
    if(!result.has("name"))result.put("name","libro.epub");return result;
  }
  private Uri incoming(Intent intent){if(Intent.ACTION_VIEW.equals(intent.getAction()))return intent.getData();if(Intent.ACTION_SEND.equals(intent.getAction()))return intent.getParcelableExtra(Intent.EXTRA_STREAM);return null;}
  @PluginMethod public void initialBook(PluginCall call){try{if(initialConsumed){call.resolve(new JSObject());return;}initialConsumed=true;Uri uri=incoming(getActivity().getIntent());call.resolve(uri!=null&&"content".equals(uri.getScheme())?metadata(uri):new JSObject());}catch(Exception error){call.reject("No se pudo abrir el archivo seleccionado.");}}
  @Override protected void handleOnNewIntent(Intent intent){getActivity().setIntent(intent);Uri uri=incoming(intent);if(uri==null||!initialConsumed)return;try{notifyListeners("openBook",metadata(uri),true);}catch(Exception ignored){}}
  @PluginMethod public void releaseBook(PluginCall call){call.resolve();}
  @PluginMethod public void chooseFolder(PluginCall call){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);try{startActivityForResult(call,intent,"folderChosen");}catch(Exception error){call.reject("No hay un selector de carpetas disponible en este dispositivo.");}}
  @ActivityCallback private void folderChosen(PluginCall call,ActivityResult result){if(call==null)return;if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.reject("Cancelado","AbortError");return;}try{Uri uri=result.getData().getData();getContext().getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);JSObject root=metadata(DocumentsContract.buildDocumentUriUsingTree(uri,DocumentsContract.getTreeDocumentId(uri)));root.put("rootId",uri.toString());root.put("kind","directory");root.put("parts",new JSArray());root.put("nativeLectorHandle",true);call.resolve(root);}catch(Exception error){call.reject("No se pudo acceder a la carpeta elegida.");}}
  private Uri root(PluginCall call)throws Exception{Uri root=Uri.parse(call.getString("rootId",""));if(!"content".equals(root.getScheme()))throw new Exception();boolean allowed=getContext().getContentResolver().getPersistedUriPermissions().stream().anyMatch(permission->permission.isReadPermission()&&permission.getUri().equals(root));if(!allowed)throw new Exception();return root;}
  private String document(Uri root,JSONArray parts)throws Exception{String id=DocumentsContract.getTreeDocumentId(root);for(int index=0;index<parts.length();index++){String name=parts.getString(index);if(name.isEmpty()||name.equals(".")||name.equals("..")||name.contains("/")||name.contains("\\")||name.indexOf(0)>=0)throw new Exception();String found=null;try(Cursor cursor=getContext().getContentResolver().query(DocumentsContract.buildChildDocumentsUriUsingTree(root,id),new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){while(cursor!=null&&cursor.moveToNext())if(name.equals(cursor.getString(1))){found=cursor.getString(0);break;}}if(found==null)throw new Exception();id=found;}return id;}
  @PluginMethod public void permission(PluginCall call){JSObject result=new JSObject();try{root(call);result.put("state","granted");}catch(Exception error){result.put("state","prompt");}call.resolve(result);}
  @PluginMethod public void listDirectory(PluginCall call){try{Uri root=root(call);String id=document(root,call.getArray("parts",new JSArray()));JSArray entries=new JSArray();try(Cursor cursor=getContext().getContentResolver().query(DocumentsContract.buildChildDocumentsUriUsingTree(root,id),new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE},null,null,null)){while(cursor!=null&&cursor.moveToNext()){JSObject item=new JSObject();item.put("name",cursor.getString(0));item.put("kind",DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(1))?"directory":"file");entries.put(item);}}JSObject result=new JSObject();result.put("entries",entries);call.resolve(result);}catch(Exception error){call.reject("No se pudo enumerar la carpeta. Vuelve a elegirla.");}}
  @PluginMethod public void readFile(PluginCall call){try{Uri root=root(call);call.resolve(metadata(DocumentsContract.buildDocumentUriUsingTree(root,document(root,call.getArray("parts",new JSArray())))));}catch(Exception error){call.reject("No se pudo abrir el archivo de la carpeta.");}}
  @PluginMethod public void saveFile(PluginCall call){if(call.getString("base64","").length()>140*1024*1024){call.reject("El archivo supera 100 MB.");return;}Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(call.getString("type","application/octet-stream"));intent.putExtra(Intent.EXTRA_TITLE,call.getString("name","Lector"));try{startActivityForResult(call,intent,"fileChosen");}catch(Exception error){call.reject("No hay un selector para guardar archivos disponible.");}}
  @ActivityCallback private void fileChosen(PluginCall call,ActivityResult result){if(call==null)return;if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){JSObject cancelled=new JSObject();cancelled.put("cancelled",true);call.resolve(cancelled);return;}try(OutputStream output=getContext().getContentResolver().openOutputStream(result.getData().getData(),"w")){output.write(Base64.decode(call.getString("base64",""),Base64.DEFAULT));call.resolve();}catch(Exception error){call.reject("No se pudo guardar el archivo.");}}
  @PluginMethod public void printHTML(PluginCall call){if(!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_PRINTING)){call.reject("Este dispositivo no dispone de impresión.");return;}getActivity().runOnUiThread(()->{WebView view=new WebView(getActivity());view.getSettings().setJavaScriptEnabled(false);view.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView web,String url){PrintManager manager=(PrintManager)getActivity().getSystemService(android.content.Context.PRINT_SERVICE);manager.print("Lector",web.createPrintDocumentAdapter("Lector"),null);call.resolve();}});view.loadDataWithBaseURL(null,call.getString("html",""),"text/html","UTF-8",null);});}
}
