using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// One native companion per extension host. Only inherited stdin/stdout carry state.
public sealed class WidgetPolicy {
 public bool Minimized, Suppressed, Manual;
 public bool Visible { get { return (Minimized || Manual) && !Suppressed; } }
 public void Update(bool minimized) { if (minimized != Minimized) { Suppressed=false; if(!minimized)Manual=false; } Minimized=minimized; }
 public void Dismiss() { Suppressed=true;Manual=false; }
 public void Show() { Suppressed=false;Manual=true; }
}
public sealed class PmdWidget : Form {
 public static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=32*1024*1024 };
 readonly Dictionary<string,object> config;
 readonly Action<object> emit;
 readonly WidgetPolicy policy=new WidgetPolicy();
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer { Interval=250 };
 readonly WebView2 browser=new WebView2 { Dock=DockStyle.Fill, DefaultBackgroundColor=Color.FromArgb(19,32,34) };
 readonly NotifyIcon tray=new NotifyIcon { Icon=SystemIcons.Application };
 IntPtr owner=IntPtr.Zero; uint ownerPid; bool searching,closing,initialized,reportedVisible,reportedMinimized;
 string property; Dictionary<string,object> latest;
 public bool Bound { get { return owner!=IntPtr.Zero; } }
 public bool Ready { get { return initialized; } }
 public WidgetPolicy Policy { get { return policy; } }
 public WebView2 Browser { get { return browser; } }
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 delegate bool WindowVisitor(IntPtr window,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowVisitor visitor,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool SetProp(IntPtr h,string key,IntPtr value);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetProp(IntPtr h,string key);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr RemoveProp(IntPtr h,string key);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
 protected override bool ShowWithoutActivation { get { return true; } }
 public PmdWidget(Dictionary<string,object> cfg,Action<object> output,bool bindOnStart=true) {
  config=cfg;emit=output;Text=(string)cfg["title"];TopMost=true;ShowInTaskbar=false;
  FormBorderStyle=FormBorderStyle.Sizable;MaximizeBox=false;MinimizeBox=true;
  MinimumSize=new Size(240,200);Size=new Size(360,310);StartPosition=FormStartPosition.Manual;
  var screen=Screen.PrimaryScreen.WorkingArea;Location=new Point(screen.Right-Width-20,screen.Bottom-Height-20);
  object saved;if(cfg.TryGetValue("bounds",out saved)&&saved is Dictionary<string,object>){
   var b=(Dictionary<string,object>)saved;try{var r=new Rectangle(Convert.ToInt32(b["left"]),Convert.ToInt32(b["top"]),Math.Max(240,Math.Min(1200,Convert.ToInt32(b["width"]))),Math.Max(200,Math.Min(1000,Convert.ToInt32(b["height"]))));var area=Screen.FromRectangle(r).WorkingArea;r.Width=Math.Min(r.Width,area.Width);r.Height=Math.Min(r.Height,area.Height);r.X=Math.Max(area.Left,Math.Min(r.X,area.Right-r.Width));r.Y=Math.Max(area.Top,Math.Min(r.Y,area.Bottom-r.Height));Bounds=r;}catch{}}
  property="PMD.Widget."+(string)cfg["marker"];
  Controls.Add(browser);var handle=Handle;var viewHandle=browser.Handle;
  tray.Text=Text.Length>63?Text.Substring(0,63):Text;
  var menu=new ContextMenuStrip();menu.Items.Add("Show widget",null,delegate{policy.Show();ApplyVisibility();});menu.Items.Add("Open guild",null,delegate{OpenGuild();});tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{policy.Show();ApplyVisibility();};
  Resize+=delegate{if(WindowState==FormWindowState.Minimized){policy.Dismiss();Hide();WindowState=FormWindowState.Normal;ApplyVisibility();}};
  ResizeEnd+=delegate{if(WindowState==FormWindowState.Normal)emit(new {type="desktopBounds",left=Left,top=Top,width=Width,height=Height});};
  FormClosing+=delegate(object sender,FormClosingEventArgs e){if(!closing){e.Cancel=true;policy.Dismiss();ApplyVisibility();}};
  timer.Tick+=delegate{PollOwner();};timer.Start();
  Initialize();
  if(bindOnStart)BindForeground();
 }
 async void Initialize(){
  try{
   var environment=await CoreWebView2Environment.CreateAsync(null,(string)config["profileDirectory"]);
   await browser.EnsureCoreWebView2Async(environment);
   if(closing||IsDisposed)return;
   var core=browser.CoreWebView2;
   core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.AreBrowserAcceleratorKeysEnabled=false;core.Settings.IsStatusBarEnabled=false;
   core.SetVirtualHostNameToFolderMapping("pmd.local",(string)config["mediaDirectory"],CoreWebView2HostResourceAccessKind.DenyCors);
   var assets=(string)config["assetDirectory"];if(assets.Length>0)core.SetVirtualHostNameToFolderMapping("assets.pmd.local",assets,CoreWebView2HostResourceAccessKind.Allow);
   core.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){if(e.Uri!="https://pmd.local/widget.html")e.Cancel=true;};
   core.FrameNavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){e.Cancel=true;};
   core.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
   core.PermissionRequested+=delegate(object sender,CoreWebView2PermissionRequestedEventArgs e){e.State=CoreWebView2PermissionState.Deny;};
   core.DownloadStarting+=delegate(object sender,CoreWebView2DownloadStartingEventArgs e){e.Cancel=true;};
   core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
   core.WebResourceRequested+=delegate(object sender,CoreWebView2WebResourceRequestedEventArgs e){var uri=new Uri(e.Request.Uri);if(uri.Scheme!="https"||(uri.Host!="pmd.local"&&uri.Host!="assets.pmd.local"))e.Response=environment.CreateWebResourceResponse(null,403,"Blocked","");};
   core.WebMessageReceived+=delegate(object sender,CoreWebView2WebMessageReceivedEventArgs e){
    if(e.Source!="https://pmd.local/widget.html")return;
    try{var message=Json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);var type=(string)message["type"];
     if(type=="openGuild")OpenGuild();else if(type=="ready"||type=="scene"||type=="quiet")emit(message);
    }catch{}
   };
   var boot=Json.Serialize(config["boot"]).Replace("<","\\u003c");
   await core.AddScriptToExecuteOnDocumentCreatedAsync("window.PMD_BOOT="+boot+";let state={};window.acquireVsCodeApi=()=>({getState:()=>state,setState:s=>{state=s;},postMessage:m=>chrome.webview.postMessage(m)});chrome.webview.addEventListener('message',e=>window.dispatchEvent(new MessageEvent('message',{data:e.data}))); ");
   core.NavigationCompleted+=delegate(object sender,CoreWebView2NavigationCompletedEventArgs e){if(!e.IsSuccess){emit(new {type="desktopError",error="The desktop widget page could not load."});Shutdown();return;}initialized=true;if(latest!=null)Message(latest);Message(new {type="visibility",visible=Visible});emit(new {type="desktopReady"});};
   core.Navigate("https://pmd.local/widget.html");
  }catch{if(closing)return;emit(new {type="desktopError",error="The desktop widget needs the Microsoft Edge WebView2 Runtime. The Explorer widget is still available."});Shutdown();}
 }
 public void Message(object message){if(initialized&&!IsDisposed)browser.CoreWebView2.PostWebMessageAsJson(Json.Serialize(message));}
 public void Receive(Dictionary<string,object> message){
  var type=(string)message["type"];
  if(type=="message") {var payload=(Dictionary<string,object>)message["message"];if((string)payload["type"]=="snapshot")latest=payload;Message(payload);}
  if(type=="bind")BindForeground();
  if(type=="show"){policy.Show();ApplyVisibility();}
 }
 public void BindForeground(){
  if(Bound||searching||closing)return;
  var candidates=new List<IntPtr>();var foreground=GetForegroundWindow();if(foreground!=IntPtr.Zero)candidates.Add(foreground);
  EnumWindows(delegate(IntPtr window,IntPtr parameter){if(window!=foreground&&IsWindowVisible(window))candidates.Add(window);return true;},IntPtr.Zero);
  BindCandidates(candidates);
 }
 internal void BindCandidate(IntPtr candidate){BindCandidates(new List<IntPtr>{candidate});}
 async void BindCandidates(List<IntPtr> candidates){
  if(Bound||searching||closing)return;
  searching=true;
  IntPtr candidate=await Task.Run(delegate{
   foreach(var window in candidates)try{
    uint pid;GetWindowThreadProcessId(window,out pid);
    using(var process=Process.GetProcessById((int)pid))if(!String.Equals(process.MainModule.FileName,(string)config["applicationPath"],StringComparison.OrdinalIgnoreCase))continue;
    // Unique accessibility marker issued by this extension host: never guess from folder/title.
    var element=AutomationElement.FromHandle(window);
    if(element.FindFirst(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,(string)config["marker"]))!=null)return window;
   }catch{}
   return IntPtr.Zero;
  });
  searching=false;if(candidate==IntPtr.Zero||closing||IsDisposed||!IsWindow(candidate))return;
  if(!SetProp(candidate,property,Handle))return;
  owner=candidate;GetWindowThreadProcessId(owner,out ownerPid);emit(new {type="desktopBound"});PollOwner();
 }
 void PollOwner(){
  if(closing)return;
  if(Bound){uint pid;GetWindowThreadProcessId(owner,out pid);if(!IsWindow(owner)||pid!=ownerPid||GetProp(owner,property)!=Handle){Shutdown();return;}policy.Update(IsIconic(owner));}
  ApplyVisibility();
 }
 void ApplyVisibility(){
  var show=policy.Visible;
  if(show&&!Visible){Show();ShowWindow(Handle,4);TopMost=true;}else if(!show&&Visible)Hide();
  tray.Visible=show||policy.Minimized;
  if(show!=reportedVisible||policy.Minimized!=reportedMinimized){reportedVisible=show;reportedMinimized=policy.Minimized;Message(new {type="visibility",visible=show});emit(new {type="desktopState",visible=show,ownerMinimized=policy.Minimized});}
 }
 void OpenGuild(){if(Bound){if(IsIconic(owner))ShowWindow(owner,9);SetForegroundWindow(owner);}policy.Manual=false;policy.Suppressed=false;emit(new {type="openGuild"});}
 public void Shutdown(){if(closing)return;closing=true;timer.Stop();timer.Dispose();if(Bound&&GetProp(owner,property)==Handle)RemoveProp(owner,property);tray.Visible=false;tray.ContextMenuStrip.Dispose();tray.Dispose();browser.Dispose();Close();Dispose();}
}
public static class WidgetProgram {
 [STAThread] public static void Main(){
  string profile=null;
  try{
   var line=Console.ReadLine();if(line==null)return;
   var config=PmdWidget.Json.Deserialize<Dictionary<string,object>>(line);
   if((string)config["type"]!="init")return;
   profile=Path.GetFullPath((string)config["profileDirectory"]);
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   var widget=new PmdWidget(config,delegate(object value){Console.WriteLine(PmdWidget.Json.Serialize(value));});
   widget.Disposed+=delegate{Application.ExitThread();};
   var reader=new Thread(delegate(){
    try{string input;while((input=Console.ReadLine())!=null){var message=PmdWidget.Json.Deserialize<Dictionary<string,object>>(input);if(widget.IsDisposed)break;widget.BeginInvoke(new Action(delegate{widget.Receive(message);}));}}
    catch{}
    try{widget.BeginInvoke(new Action(widget.Shutdown));}catch{}
   });reader.IsBackground=true;reader.Start();Application.Run();
  }catch{Console.WriteLine("{\"type\":\"desktopError\",\"error\":\"The desktop companion could not initialize.\"}");}
  finally{
   // The extension host may already be gone. Clean only our uniquely named cache,
   // after disposing WebView2 and allowing its browser process to release locks.
   Guid id;if(profile!=null&&Guid.TryParse(Path.GetFileName(profile),out id)){
    for(int attempt=0;attempt<8;attempt++)try{if(Directory.Exists(profile))Directory.Delete(profile,true);break;}catch{Thread.Sleep(400);}
   }
  }
 }
}
