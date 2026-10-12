using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

public static class WidgetTests {
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);
 delegate bool WindowVisitor(IntPtr window,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowVisitor visitor,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 static void Check(bool value,string message){if(!value)throw new Exception(message);}
 static async Task Until(Func<bool> predicate,string message){var end=DateTime.UtcNow.AddSeconds(20);while(!predicate()&&DateTime.UtcNow<end)await Task.Delay(100);Check(predicate(),message);}
 static Dictionary<string,object> Config(string root,string marker){
  var pack=PmdWidget.Json.DeserializeObject(File.ReadAllText(Path.Combine(root,"assets/local/manifest.json")));
  return new Dictionary<string,object>{{"size",new Dictionary<string,object>{{"width",460},{"height",440}}},{"bounds",new Dictionary<string,object>{{"left",40},{"top",40},{"width",300},{"height",250}}},{"title","PMD widget test"},{"marker",marker},{"applicationPath",Process.GetCurrentProcess().MainModule.FileName},{"profileDirectory",Path.Combine(root,"artifacts/native-profiles",Guid.NewGuid().ToString())},{"mediaDirectory",Path.Combine(root,"media")},{"assetDirectory",Path.Combine(root,"assets/local")},{"focused",false},{"boot",new {pack=pack,assetBase="https://assets.pmd.local/",mode="live",presentation="desktop",agents=new object[0]}}};
 }
 static Dictionary<string,object> Command(string type){return new Dictionary<string,object>{{"type",type}};}
 [STAThread] public static void Main(string[] args){
  if(args.Length==2&&args[0]=="--visible"){
   bool found=false;EnumWindows(delegate(IntPtr window,IntPtr parameter){uint pid;GetWindowThreadProcessId(window,out pid);if(pid==UInt32.Parse(args[1])&&IsWindowVisible(window))found=true;return true;},IntPtr.Zero);Console.WriteLine(found?"visible":"hidden");return;
  }
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  var ownerA=new Form { Text="PMD fixture A",Width=400,Height=250 };
  var ownerB=new Form { Text="PMD fixture B",Width=400,Height=250 };
  var markerA="PMD test "+Guid.NewGuid();var markerB="PMD test "+Guid.NewGuid();
  ownerA.Controls.Add(new Button {Text="Owner A",AccessibleName=markerA});ownerB.Controls.Add(new Button {Text="Owner B",AccessibleName=markerB});
  PmdWidget a=null,b=null;int result=1;
  ownerA.Shown+=async delegate{
   try{
    var policy=new WidgetPolicy();Check(!policy.Visible,"initially hidden");policy.Update(true);Check(policy.Visible,"minimize shows");policy.Dismiss();Check(!policy.Visible,"dismiss hides");policy.Update(true);Check(!policy.Visible,"stays dismissed");policy.Update(false);policy.Update(true);Check(policy.Visible,"new minimize resets dismissal");
    a=new PmdWidget(Config(args[0],markerA),value=>Console.WriteLine(PmdWidget.Json.Serialize(value)),false);
    // Opening size comes from settings; a remembered (smaller) size is ignored, its position kept.
    Check(a.Size==new System.Drawing.Size(460,440),"configured opening size: "+a.Size);Check(a.Left==40&&a.Top==40,"remembered position: "+a.Location);
    Check(PmdWidget.ConfiguredSize(new Dictionary<string,object>())==new System.Drawing.Size(360,310),"default size without settings");
    Check(PmdWidget.ConfiguredSize(new Dictionary<string,object>{{"width",5000},{"height",10}})==new System.Drawing.Size(1200,200),"size clamps to the window limits");
    var resize=Command("size");resize["width"]=500;resize["height"]=420;a.Receive(resize);Check(a.Size==new System.Drawing.Size(500,420),"a settings change resizes the open widget");
    // Icon: the first frame of the front-facing row, trimmed and squared; the window takes it.
    var sheetPath=Path.Combine(Path.GetTempPath(),"pmd-icon-"+Guid.NewGuid()+".png");
    using(var sheet=new System.Drawing.Bitmap(80,80)){using(var g=System.Drawing.Graphics.FromImage(sheet)){g.Clear(System.Drawing.Color.Transparent);g.FillRectangle(System.Drawing.Brushes.Red,10,12,10,20);g.FillRectangle(System.Drawing.Brushes.Blue,50,0,30,40);g.FillRectangle(System.Drawing.Brushes.Green,0,40,40,40);}sheet.Save(sheetPath);}
    var cut=PmdWidget.SpriteIcon(sheetPath,40,40,32);Check(cut!=null&&cut.Width==32&&cut.Height==32,"sprite icon is 32px square");
    using(var bmp=cut.ToBitmap()){var c=bmp.GetPixel(16,28);Check(c.R>200&&c.B<50&&c.G<50,"icon uses the first front-facing frame only: "+c);}
    var before=a.Icon;var setIcon=Command("icon");setIcon["path"]=sheetPath;setIcon["frameWidth"]=40;setIcon["frameHeight"]=40;a.Receive(setIcon);Check(!ReferenceEquals(a.Icon,before),"window takes the sprite icon");
    var missing=Command("icon");missing["path"]=sheetPath+".missing";missing["frameWidth"]=40;missing["frameHeight"]=40;var kept=a.Icon;a.Receive(missing);Check(ReferenceEquals(a.Icon,kept),"a missing sheet keeps the current icon");
    File.Delete(sheetPath);
    b=new PmdWidget(Config(args[0],markerB),value=>{},false);
    // The test launcher suppresses its console; explicitly display only our fixture windows.
    ShowWindow(ownerA.Handle,4);ownerB.Show();await Task.Delay(500);a.BindCandidate(ownerB.Handle);await Task.Delay(700);Check(!a.Bound,"wrong owner must not bind");
    b.BindCandidate(ownerB.Handle);await Until(()=>b.Bound,"B must bind to B");
    await Until(()=>{a.BindCandidate(ownerA.Handle);return a.Bound;},"A must bind to A");
    await Until(()=>a.Ready&&b.Ready,"WebView2 must initialize");
    // Show before checking rendering: WebView2 throttles documents in hidden windows.
    ownerA.WindowState=FormWindowState.Minimized;
    await Until(()=>a.Visible,"minimized owner shows widget");Check(a.TopMost&&!b.Visible,"only A pops out, always on top");
    var dom=await a.Browser.CoreWebView2.ExecuteScriptAsync("document.body.classList.contains('compact') && !!document.querySelector('canvas') && document.querySelectorAll('#scene option').length >= 11");
    Check(dom=="true","real compact renderer and all Friend Areas load: "+dom);
    await a.Browser.CoreWebView2.ExecuteScriptAsync("window.assetLoaded=false;{const i=new Image();i.onload=()=>window.assetLoaded=i.naturalWidth>0;i.src=window.PMD_BOOT.assetBase+window.PMD_BOOT.pack.maps[0].file}");
    await Task.Delay(500);
    Check(await a.Browser.CoreWebView2.ExecuteScriptAsync("window.assetLoaded")=="true","native asset origin loads map images");
    a.WindowState=FormWindowState.Minimized;await Until(()=>!a.Visible,"own minimize hides widget");await Task.Delay(700);Check(!a.Visible,"dismissed widget stays hidden");
    a.Receive(Command("show"));await Until(()=>a.Visible,"manual show restores dismissed widget");
    ownerA.WindowState=FormWindowState.Normal;await Until(()=>!a.Visible,"owner restore hides widget");
    ownerA.WindowState=FormWindowState.Minimized;await Until(()=>a.Visible,"next owner minimize shows widget");
    a.Close();await Until(()=>!a.Visible,"close dismisses instead of terminating");Check(!a.IsDisposed,"dismiss preserves companion");
    ownerB.WindowState=FormWindowState.Minimized;await Until(()=>b.Visible,"second owner independently minimizes");Check(!a.Visible,"B does not revive dismissed A");
    ownerA.Close();await Until(()=>a.IsDisposed,"owner close cleans companion");Check(!b.IsDisposed,"B survives A closing");
    Console.WriteLine("PASS: native binding isolation, WebView2 renderer/assets, minimize, dismiss, restore, topmost and owner cleanup.");result=0;
   }catch(Exception error){Console.Error.WriteLine(error);}
   finally{if(a!=null)a.Shutdown();if(b!=null)b.Shutdown();ownerA.Dispose();ownerB.Dispose();Application.ExitThread();}
  };
  // A context without MainForm lets the owner-close lifecycle be tested without ending the loop.
  ownerA.Show();Application.Run();Environment.ExitCode=result;
 }
}
