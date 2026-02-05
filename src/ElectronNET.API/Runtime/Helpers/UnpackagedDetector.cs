namespace ElectronNET.Runtime.Helpers
{
    using System;
    using System.Collections.Generic;
    using System.Diagnostics;
    using System.IO;
    using System.Linq;

    internal class UnpackagedDetector
    {
        public static bool CheckIsUnpackaged()
        {
            var tests = new List<Func<bool?>>();

            tests.Add(CheckUnpackaged1);

            // We let this one account twice
            tests.Add(CheckUnpackaged2);
            tests.Add(CheckUnpackaged2);

            tests.Add(CheckUnpackaged3);
            tests.Add(CheckUnpackaged4);

            int scoreUnpackaged = 0, scorePackaged = 0;

            foreach (var test in tests)
            {
                var res = test();

                if (res == true)
                {
                    scoreUnpackaged++;
                }

                if (res == false)
                {
                    scorePackaged++;
                }
            }

            Console.WriteLine("Probe scored for package mode:   Unpackaged {0} vs. {1} Packaged", scoreUnpackaged, scorePackaged);
            return scoreUnpackaged > scorePackaged;
        }

        private static bool? CheckUnpackaged1()
        {
            var cfg = ElectronNetRuntime.BuildInfo.BuildConfiguration;
            if (cfg != null)
            {
                if (cfg.Equals("Debug", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (cfg.Equals("Release", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            return null;
        }

        private static bool? CheckUnpackaged2()
        {
            var dir = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
            
            // Electron-First 打包模式：.NET 在 resources/bin 中
            if (dir.Name == "bin" && dir.Parent?.Name == "resources")
            {
                return false;
            }

            // DotNet-First 打包模式：Electron 在 electron 子目录中
            if (dir.GetDirectories().Any(e => e.Name == "electron"))
            {
                return false;
            }

            // 开发模式：.electron 子目录存在
            if (dir.GetDirectories().Any(e => e.Name == ".electron"))
            {
                return true;
            }

            return null;
        }

        private static bool? CheckUnpackaged3()
        {
            if (Debugger.IsAttached)
            {
                return true;
            }


            return null;
        }

        private static bool? CheckUnpackaged4()
        {
            var isUnpackaged = ElectronNetRuntime.ProcessArguments.Any(e => e.Contains("unpacked", StringComparison.OrdinalIgnoreCase));

            if (isUnpackaged)
            {
                return true;
            }

            var isPackaged = ElectronNetRuntime.ProcessArguments.Any(e => e.Contains("dotnetpacked", StringComparison.OrdinalIgnoreCase));
            if (isPackaged)
            {
                return false;
            }

            return null;
        }
    }
}